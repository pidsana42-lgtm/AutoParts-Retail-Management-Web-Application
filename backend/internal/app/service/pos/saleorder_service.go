package pos

import (
    "backend/internal/app/dto/pos"
    "backend/internal/app/entity"
    "backend/internal/app/enum"
    customerRepo "backend/internal/app/repository/customer"
    posRepo "backend/internal/app/repository/pos"
    productRepo "backend/internal/app/repository/pos"
	customerDto "backend/internal/app/dto/customer"
    
    "errors"
    "fmt"
    "gorm.io/gorm"
    "time"
)

type SaleService interface {
CreatePOSOrder(req *pos.CreateSaleOrderRequest, userID uint) error
    GetCustomerTypes() ([]entity.CustomerType, error)
    SearchCustomers(searchQuery string) ([]customerDto.CustomerResponse, error)
    GetPaymentMethods() ([]pos.PaymentMethodResponse, error)
}

type saleService struct {
    repo         posRepo.SaleRepository
    customerRepo customerRepo.CustomerRepository
    productRepo  productRepo.POSProductRepository // เอาไว้ดึงทุนและหักสต็อก
}

func NewSaleService(repo posRepo.SaleRepository, cRepo customerRepo.CustomerRepository, pRepo productRepo.POSProductRepository) SaleService {
    return &saleService{
        repo:         repo,
        customerRepo: cRepo,
        productRepo:  pRepo,
    }
}

func (s *saleService) CreatePOSOrder(req *pos.CreateSaleOrderRequest, userID uint) error {
    // -------------------------------------------------------------------------
    // [เตรียมระบบฐานข้อมูลและดึงข้อมูลตั้งต้น]
    // -------------------------------------------------------------------------

    // tx คือตัวแปรเก็บสถานะ "Transaction" มัดรวมคำสั่ง SQL ทั้งหมดในบิลนี้ไว้ด้วยกัน
    // ถ้ามีคำสั่งไหนพังกลางทาง ระบบจะไม่บันทึกอะไรเลย (ป้องกันข้อมูลพัง)
    tx := s.repo.BeginTransaction()

    // ดักจับกรณีที่โค้ดเกิด Runtime Panic ให้สั่ง Rollback คืนค่าทันที
    defer func() {
        if r := recover(); r != nil {
            tx.Rollback()
        }
    }()

    var customer *entity.Customer
    var err error

    // 1. ดึงชื่อชั่วคราวและเบอร์โทรมาล็อคไว้ในตัวแปร Local ทันที ป้องกันค่าโดนเขียนทับหรือสูญหาย
    savedName := "ลูกค้าทั่วไป (หน้าร้าน)"
    if req.CustomerNameTemp != "" {
        savedName = req.CustomerNameTemp
    }
    
    savedPhone := ""
    if req.CustomerPhoneTemp != "" {
        if len(req.CustomerPhoneTemp) > 20 {
            savedPhone = req.CustomerPhoneTemp[:20]
        } else {
            savedPhone = req.CustomerPhoneTemp
        }
    }

    // 2. ดักเช็คเงื่อนไขจากค่า Original ที่ส่งมาจากหน้าบ้าน (0 หรือ 1 คือลูกค้าขาจร)
    if req.CustomerID == 0 || req.CustomerID == 1 {
        customer = &entity.Customer{
            CustomerName:      savedName,
            IsDiscountEnabled: false,
            CurrentDebtAmount: 0.0,
            CreditLimit:       0.0,
        }
        customer.CustomerType.TypeName = "GENERAL"
        
    } else {
        // กรณีเป็นลูกค้าสมาชิก / อู่
        customer, err = s.customerRepo.GetCustomerByID(req.CustomerID)
        if err != nil {
            tx.Rollback()
            return errors.New("ไม่พบข้อมูลลูกค้าในระบบ")
        }
        // ถ้าหน้าบ้านไม่ได้ใส่ชื่อ/เบอร์ชั่วคราวมา ให้ดึงชื่อจริงจากข้อมูลสมาชิกมาใช้
        if req.CustomerNameTemp == "" {
            savedName = customer.CustomerName
        }
        if req.CustomerPhoneTemp == "" {
            savedPhone = customer.PhoneNumber
        }
    }

    // เจนเลขที่บิลขายอัตโนมัติ (เช่น INV2607030001)
    orderNumber, err := s.generateOrderNumber(tx)
    if err != nil {
        tx.Rollback()
        return fmt.Errorf("ไม่สามารถสร้างเลขที่บิลอัตโนมัติได้: %w", err)
    }

    // -------------------------------------------------------------------------
    // [ตั้งตัวแปรสะสมภาพรวมของทั้งบิล (Grand Totals)]
    // -------------------------------------------------------------------------
    
    // subtotalAmount ใช้สะสม "ยอดรวมราคาเต็มของสินค้าทุกชิ้น" คูณจำนวน (ก่อนหักส่วนลดใดๆ)
    var subtotalAmount float64            

    // totalDiscountItems ใช้สะสม "มูลค่าส่วนลดรายบรรทัดรวมกันทั้งบิล" (บาท)
    var totalDiscountItems float64        

    // orderItems คือ Slice (อาเรย์ยืดหยุ่น) สำหรับเตรียมเก็บรายการสินค้าแต่ละแถวเพื่อยัดลงฐานข้อมูลพร้อมกัน
    var orderItems []entity.SaleOrderItem 

    // -------------------------------------------------------------------------
    // [LOOP รอบที่ 1: วนคำนวณส่วนลด Layer 1 (สินค้า) + Layer 2 (อู่)]
    // -------------------------------------------------------------------------
    
    // วนลูปสินค้าทีละรายการที่หน้าบ้านส่งมาในตะกร้า (req.Items)
    // itemReq คือตัวแปรแทนข้อมูลสินค้าชิ้นนั้น ๆ ที่กำลังคำนวณอยู่ในลูปรอบปัจจุบัน
    for _, itemReq := range req.Items {
        
        // product คือออบเจกต์ข้อมูลตัวสินค้าชิ้นนี้ที่ดึงจาก DB (เอาไว้ดูสต็อก ทุน และเพดานส่วนลด)
        product, err := s.productRepo.GetProductByID(itemReq.ProductID)
        if err != nil {
            tx.Rollback()
            return fmt.Errorf("ไม่พบสินค้า ID %d", itemReq.ProductID)
        }

        // เช็คว่าของในคลัง (product.Quantity) มีพอกับที่ลูกค้าจะสั่งซื้อ (itemReq.Qty) ไหม
        if product.Quantity < itemReq.Qty {
            tx.Rollback()
            return fmt.Errorf("สินค้า %s สต็อกไม่พอขาย (เหลือ %d ชิ้น)", product.Product_Name, product.Quantity)
        }

        // 1. ดึงส่วนลดที่หน้าบ้านส่งมาคีย์ขายในบิลนี้
        var itemDiscountPercent float64
        if itemReq.DiscountType == "percentage" {
            itemDiscountPercent = itemReq.DiscountValue
        } else if itemReq.DiscountType == "amount" && itemReq.UnitPrice > 0 {
            itemDiscountPercent = (itemReq.DiscountValue / itemReq.UnitPrice) * 100
        }

        // 2. ตั้งต้นเพดานสูงสุดจากตัวสินค้าก่อน (เช่น 2.00%)
        allowedMaxDiscount := product.MaxDiscountRate 

        // 3. ถ้าเป็นลูกค้ากลุ่ม GARAGE และเปิดใช้งานระบบส่วนลดอู่ 
        // ให้เอาสิทธิ์ On-top ของอู่คนนี้มาขยายเพดานเพิ่มเข้าไปด้วย!
        if customer.CustomerType.TypeName == "GARAGE" && customer.IsDiscountEnabled {
            // บวกเพิ่มเพดานตามสิทธิ์ที่เจ้าของร้าน Set ให้ลูกค้าเครดิตดีคนนี้ (เช่น 2% + 3% = 5%)
            allowedMaxDiscount += customer.OntopDiscountRate
        }

        // ตรวจสอบส่วนลดที่ส่งมา กับ "เพดานใหม่ที่ผสมสิทธิ์อู่แล้ว"
        // ทีนี้ถ้าหน้าบ้านส่งมา 5.00% แล้วเพดานใหม่คือ 5.00% ก็จะผ่านฉลุย ไม่ระเบิดแล้วครับ!
        if itemDiscountPercent > allowedMaxDiscount {
            tx.Rollback()
            return fmt.Errorf("สินค้า %s มีส่วนลดต่อชิ้น %.2f%% ซึ่งเกินกว่าเกณฑ์สูงสุดที่ยอมให้ลดได้สำหรับลูกค้าท่านนี้ (สูงสุด %.2f%%)", 
                product.Product_Name, itemDiscountPercent, allowedMaxDiscount)
        }

        // 4. คำนวณเงินส่วนลดบาทของแถวนี้โดยอิงจากค่าที่ผ่านการอนุมัติแล้ว
        // สูตร: (ราคาเต็มต่อหน่วย × %ส่วนลดรวม / 100) × จำนวนชิ้นที่สั่งซื้อ
        itemDiscountAmount := (itemReq.UnitPrice * itemDiscountPercent / 100) * float64(itemReq.Qty)
        
        // finalUnitPrice คือราคาเน็ตต่อหน่วยหลังหักลดรายชิ้นแล้ว (ราคาเต็ม - เงินลดเฉลี่ยต่อหน่วย)
        finalUnitPrice := itemReq.UnitPrice - (itemDiscountAmount / float64(itemReq.Qty))
        
        // itemSubtotal คือยอดรวมราคาสุทธิของแถวนี้ (ราคาเน็ตต่อหน่วย × จำนวนชิ้น)
        itemSubtotal := finalUnitPrice * float64(itemReq.Qty)

        // บวกสะสมยอดรวมของทั้งบิลไปเรื่อย ๆ ตามจำนวนสินค้าในตะกร้า
        subtotalAmount += itemReq.UnitPrice * float64(itemReq.Qty) // ยอดรวมราคาเต็มร้าน
        totalDiscountItems += itemDiscountAmount                   // ยอดรวมเงินส่วนลดชิ้นทั้งหมด

        // ยัดข้อมูลสินค้าแถวนี้ลงโครงสร้างตาราง SaleOrderItem เตรียมพร้อมรอเซฟ
        orderItems = append(orderItems, entity.SaleOrderItem{
            OrderNumber:     orderNumber,
            ProductID:       itemReq.ProductID,
            PartNumber:      product.Part_Number,
            ProductName:     product.Product_Name,
            Qty:             itemReq.Qty,
            Unit:            product.Unit.Unit_Name,
            UnitPrice:       itemReq.UnitPrice,
            CostPrice:       product.Cost_price,
            DiscountType:    itemReq.DiscountType,   
            DiscountValue:   itemReq.DiscountValue,  
            DiscountPercent: itemDiscountPercent,    
            DiscountAmount:  itemDiscountAmount,
            FinalUnitPrice:  finalUnitPrice,
            Subtotal:        itemSubtotal, 
        })

        // สั่งตัดสต็อกสินค้าชิ้นนี้ในคลังออกตามจำนวนที่ขายจริง (ทำงานภายใต้ท่อ Transaction)
        product.Quantity -= itemReq.Qty
        if err := s.productRepo.UpdateProductWithTx(tx, product); err != nil {
            tx.Rollback()
            return fmt.Errorf("หักสต็อกสินค้า %s ล้มเหลว", product.Product_Name)
        }
    }

    // -------------------------------------------------------------------------
    // [LAYER 3: คำนวณส่วนลดท้ายบิลภาพรวม (Bill Discount)]
    // -------------------------------------------------------------------------
    var billDiscountAmount float64
    var billDiscountPercent float64
    
    // ยอดคงเหลือทั้งหมดของบิลหลักหลังลบส่วนลดต่อชิ้นออกไปเรียบร้อยแล้ว
    orderSubtotalAfterItems := subtotalAmount - totalDiscountItems 

    if req.BillDiscountType == "percentage" && orderSubtotalAfterItems > 0 {
        billDiscountPercent = req.BillDiscountValue
        billDiscountAmount = orderSubtotalAfterItems * billDiscountPercent / 100
    } else if req.BillDiscountType == "amount" {
        billDiscountAmount = req.BillDiscountValue
        if orderSubtotalAfterItems > 0 {
            billDiscountPercent = (billDiscountAmount / orderSubtotalAfterItems) * 100
        }
    }

    // ดึงนโยบายของร้านค้าจากฐานข้อมูลมาตรวจสอบเพดานท้ายบิลตรง ๆ
    storeConfig, err := s.repo.GetStoreConfig()
    if err != nil {
        tx.Rollback()
        return fmt.Errorf("ไม่สามารถเรียกดูข้อมูลนโยบายความปลอดภัยร้านค้าได้: %w", err)
    }
    isCompany := customer.CustomerType.TypeName == "WHOLESALE" || customer.CustomerType.ID == 3
    // [CHECK]: ตรวจสอบเฉพาะส่วนลดท้ายบิลเพียวๆ ห้ามเกิน MaxExtraDiscountRate ของร้านเด็ดขาด!
    if !isCompany && billDiscountPercent > (storeConfig.MaxExtraDiscountRate + 0.01) {
        tx.Rollback()
        return fmt.Errorf("ส่วนลดท้ายบิลรวม %.2f%% เกินกว่านโยบายความปลอดภัยของร้านค้าที่กำหนดไว้ (สูงสุด %.2f%%)", 
            billDiscountPercent, storeConfig.MaxExtraDiscountRate)
    }

    // -------------------------------------------------------------------------
    // [LOOP รอบที่ 2: เฉลี่ยส่วนลดท้ายบิลลงสินค้า (Weighted Average สำหรับรองรับคืนเงิน)]
    // -------------------------------------------------------------------------
    // (ท่อนนี้คงเดิมไว้เลยครับ เพราะมันเอาค่ายอดรวมท้ายบิลที่ผ่านการอนุมัติแล้ว 
    // มาถัวเฉลี่ยแจกแจงลงฟิลด์ NetSubtotal ของแต่ละแถวเพื่อรอใช้ตอนลูกค้ามาเคลมคืนเงินเฉย ๆ)
    var distributedBillDiscount float64 
    for i := range orderItems {
        if orderSubtotalAfterItems > 0 {
            if i == len(orderItems)-1 {
                orderItems[i].AllocatedBillDiscount = billDiscountAmount - distributedBillDiscount
            } else {
                weight := orderItems[i].Subtotal / orderSubtotalAfterItems
                allocatedAmount := billDiscountAmount * weight
                allocatedAmount = float64(int(allocatedAmount*100+0.5)) / 100
                
                orderItems[i].AllocatedBillDiscount = allocatedAmount
                distributedBillDiscount += allocatedAmount            
            }
        }
        orderItems[i].NetSubtotal = orderItems[i].Subtotal - orderItems[i].AllocatedBillDiscount
    }

    // totalAmount คือยอดเงินเน็ตสุทธิรวมขวาล่างสุดที่ลูกค้าต้องควักกระเป๋าจ่ายจริง ๆ
    totalAmount := orderSubtotalAfterItems - billDiscountAmount

    // -------------------------------------------------------------------------
    // [จัดการระบบเครดิตเงินกู้ และอัปเดตสถานะบัญชีลูกค้า]
    // -------------------------------------------------------------------------
    
    // paymentMethod คือออบเจกต์ตรวจสอบช่องทางชำระเงินที่เลือก (เช่น เงินสด โอน หรือเครดิตอู่)
    paymentMethod, err := s.repo.GetPaymentMethodByID(req.PaymentMethodID)
    if err != nil {
        tx.Rollback()
        return fmt.Errorf("ไม่พบช่องทางการชำระเงินในระบบ: %w", err)
    }
    if !paymentMethod.IsActive {
        tx.Rollback()
        return fmt.Errorf("ช่องทางการชำระเงิน %s ถูกปิดใช้งานในขณะนี้", paymentMethod.MethodName)
    }

    var paymentStatus string // ใช้เก็บข้อความสถานะจ่ายเงิน ("paid" หรือ "unpaid")
    var balanceDue float64   // ยอดหนี้คงค้างของบิลนี้
    var paidAmount float64   //
    var changeAmount float64  // ยอดเงินทอนลูกค้า (กรณีจ่ายเกิน)
    var receivedAmount float64 // ยอดเงินที่ลูกค้าจ่ายเข้ามา (รวมทุกช่องทาง)
    var dueDate *time.Time // กำหนดวันครบกำหนดชำระเงิน (สำหรับเครดิตอู่)

    // ตรวจสอบเงื่อนไขว่าเป็นการเลือกชำระแบบ "ซื้อเชื่อ / แปะโป้งเครดิตอู่" ใช่ไหม
    if paymentMethod.IsCredit {
    if req.CustomerID == 0 || req.CustomerID == 1 {
        tx.Rollback()
        return errors.New("ลูกค้าทั่วไป/ขาจร ไม่สามารถเลือกชำระแบบซื้อเชื่อได้")
    }

    if customer.CurrentDebtAmount+totalAmount > customer.CreditLimit {
            tx.Rollback()
            return fmt.Errorf("วงเงินเครดิตไม่เพียงพอ! วงเงินคงเหลือขาดไป %.2f บาท", (customer.CurrentDebtAmount+totalAmount)-customer.CreditLimit)
        }

		paymentStatus = "unpaid" // สถานะ: ยังค้างชำระ
		balanceDue = totalAmount // ยอดค้างชำระ = ยอดสุทธิทั้งบิล
		paidAmount = 0.00        // ยังไม่ได้รับเงิน

        storeConfig, err := s.repo.GetStoreConfig()
        if err == nil && storeConfig.MaxOverdueDays > 0 {
            calculatedDueDate := time.Now().AddDate(0, 0, storeConfig.MaxOverdueDays)
            dueDate = &calculatedDueDate // ตั้งค่า DueDate สำหรับบิลเงินเชื่อ
        } else {
            // Fallback กรณีหา config ไม่เจอ (เช่น ค่าตั้งต้น 30 วัน)
            defaultDueDate := time.Now().AddDate(0, 0, 30)
            dueDate = &defaultDueDate
        }

		// บวกยอดหนี้สะสมเพิ่มเข้าบัญชีลูกค้า
        customer.CurrentDebtAmount += totalAmount
        
		// UPDATE ยอดหนี้สะสมลูกค้าลง DB (ใน TX เดียวกัน)
        if err := tx.Session(&gorm.Session{}).Save(customer).Error; err != nil {
            tx.Rollback()
            return fmt.Errorf("อัปเดตยอดหนี้สะสมของลูกค้าล้มเหลว: %v", err)
        }
    } else {
        // กรณี: ชำระเงินสด / โอน (ปรับปรุง Logic จ่ายเกิน/เงินทอน ตรงนี้)
        receivedAmount = req.ReceivedAmount
        
        // ถ้าหน้าบ้านไม่ได้ส่ง received_amount มา หรือส่งมาน้อยกว่ายอดที่ต้องจ่าย 
        // ให้ fallback ไปเป็นจ่ายพอดี (ป้องกันระบบพัง/ติดลบ)
        if receivedAmount < totalAmount {
            receivedAmount = totalAmount
        }

        paymentStatus = "paid"   
        balanceDue = 0.00        
        paidAmount = totalAmount // เงินที่ร้านได้เข้ากระเป๋าจริง (หักทอนแล้ว) = ยอดสุทธิ
        changeAmount = receivedAmount - totalAmount // คำนวณเงินทอน
    }

	// 8. ประกอบ SaleOrder Entity เพื่อบันทึก
    order := &entity.SaleOrder{
        OrderNumber:        orderNumber,
        OrderDate:          time.Now(),
        DueDate:            dueDate, // สำหรับเครดิตอู่
        CustomerID:         req.CustomerID,
        CustomerNameTemp:   &savedName,         // ใช้ Pointer ชี้ไปที่ตัวแปรอิสระที่เราแช่แข็งค่าไว้
        CustomerPhoneTemp:  &savedPhone,        // ใช้ Pointer ชี้ไปที่เบอร์โทร Local
        Customer:           entity.Customer{},  // ป้องกัน GORM สั่ง INSERT ข้อมูลลูกค้าซ้ำ (เพราะเรามี CustomerID อยู่แล้ว)
        Status:             "completed",
        PaymentStatus:      enum.PaymentStatus(paymentStatus),
        Subtotal:           orderSubtotalAfterItems, 
        BillDiscountType:   req.BillDiscountType,
        BillDiscountValue:  req.BillDiscountValue,
        DiscountAmount:     billDiscountAmount,
        DiscountPercent:    billDiscountPercent,
        TotalDiscountItems: totalDiscountItems,
        TotalAmount:        totalAmount,
        ReceivedAmount:     receivedAmount, // บันทึกเงินที่รับมาจริง (เช่น 1000.00)
        PaidAmount:         paidAmount,     // บันทึกเงินเน็ตเข้าคลัง (เช่น 870.00)
        BalanceDue:         balanceDue,
        ChangeAmount:       changeAmount,
        Note:               req.Note,
        Items:              orderItems, // ผูกอาเรย์สินค้าลูกเข้าไปด้วย GORM จะสั่งบันทึกตารางไอเทมพ่วงให้เองอัตโนมัติ
    }

	// 9. สั่งเซฟลงฐานข้อมูลผ่าน Repository ด้วยท่อ Transaction
    if err := s.repo.CreateOrderWithTx(tx, order); err != nil {
        tx.Rollback()
        return err
    }

    // 10. สร้าง Entity สำหรับบันทึกข้อมูลการชำระเงิน (Payment) ของบิลนี้
    now := time.Now()
    payment := &entity.Payment{
        OrderID:         order.ID, // ตรงนี้จะถูกต้องแล้วเพราะ order.ID ถูกใส่ค่าให้แล้ว
        PaymentMethodID: req.PaymentMethodID,
        Amount:          paidAmount,
        ReceivedAmount:  receivedAmount,
        ChangeAmount:    changeAmount,
        ReferenceNumber: "", // สามารถปรับให้รับจาก req ได้ถ้าต้องการ
        PaidAt:          &now, 
        ReceivedByID:    userID,
    }

    if err := tx.Create(payment).Error; err != nil {
        tx.Rollback()
        return fmt.Errorf("บันทึกข้อมูลการชำระเงินล้มเหลว: %v", err)
    }

    // 11. ทำการ Commit
    if err := tx.Commit().Error; err != nil {
        tx.Rollback()
        return fmt.Errorf("Commit Error: %v", err)
    }

    return nil 
}

func (s *saleService) generateOrderNumber(tx *gorm.DB) (string, error) {
    loc, err := time.LoadLocation("Asia/Bangkok")
    if err != nil {
        loc = time.Local
    }
    now := time.Now().In(loc)

    // ฟอร์แมตวันเวลาแบบย่อ: ปี ค.ศ. 2 หลัก (26) + เดือน (06) + วัน (25) -> "260625"
    dateStr := now.Format("060102") 
    prefix := "INV" + dateStr // ผลลัพธ์จะได้เป็น "INV260625"

    var count int64
    // วิ่งไปนับดูว่า วันนี้มีบิลที่รหัสขึ้นต้นด้วย INV260625... ไปแล้วกี่ใบ
    err = tx.Model(&entity.SaleOrder{}).
        Where("order_number LIKE ?", prefix+"%").
        Count(&count).Error
        
    if err != nil {
        return "", err
    }

    // เอาจำนวนที่นับได้ + 1 แล้วจัดให้เป็นเลข 4 หลัก (เช่น 0001, 0002)
    runningNumber := fmt.Sprintf("%04d", count+1)

    // ประกอบรวม เช่น "INV2606250001"
    return prefix + runningNumber, nil
}

// เพิ่มฟังก์ชัน GetCustomerTypes ต่อสายตรงไปหา customerRepo
func (s *saleService) GetCustomerTypes() ([]entity.CustomerType, error) {
    return s.repo.GetCustomerTypes() 
}

// เพิ่มฟังก์ชัน SearchCustomers และแปลงรูปข้อมูลผ่าน DTO สลักลงบิล POS 
func (s *saleService) SearchCustomers(searchQuery string) ([]customerDto.CustomerResponse, error) {
	// ค้นหารายชื่ออู่หรือเบอร์โทรจากฐานข้อมูล
	customers, err := s.repo.SearchCustomers(searchQuery)
    if err != nil {
        return nil, err
    }
    return customerDto.ToCustomerListResponse(customers), nil
}

func (s *saleService) GetPaymentMethods() ([]pos.PaymentMethodResponse, error) {
    methods, err := s.repo.GetPaymentMethods()
    if err != nil {
        return nil, err
    }
    return pos.ToPaymentMethodResponseList(methods), nil
}