package pos

import (
    customerDto "backend/internal/app/dto/customer"
    "backend/internal/app/dto/pos"
    "backend/internal/app/entity"
    "backend/internal/app/enum"
    customerRepo "backend/internal/app/repository/customer"
    posRepo "backend/internal/app/repository/pos"
    productRepo "backend/internal/app/repository/pos"
    
    "errors"
    "fmt"
    "time"
    "gorm.io/gorm"
)

type SaleService interface {
    // ปรับ Return Type ให้ส่งคืน *entity.SaleOrder กลับออกไปด้วย
    CreatePOSOrder(req *pos.CreateSaleOrderRequest, userID uint) (*entity.SaleOrder, error)
    GetCustomerTypes() ([]entity.CustomerType, error)
    SearchCustomers(searchQuery string) ([]customerDto.CustomerResponse, error)
    GetPaymentMethods() ([]pos.PaymentMethodResponse, error)
    UpdatePOSOrder(orderNumber string, req *pos.UpdateSaleOrderRequest, userID uint) (*entity.SaleOrder, error)
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

// ปรับ Signature ให้ส่งคืน (*entity.SaleOrder, error)
func (s *saleService) CreatePOSOrder(req *pos.CreateSaleOrderRequest, userID uint) (*entity.SaleOrder, error) {

    loc, err := time.LoadLocation("Asia/Bangkok")
    if err != nil {
        loc = time.Local
    }
    now := time.Now().In(loc)
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
    var customerIDForOrder *uint // ใช้ Pointer เพื่อให้บันทึกเป็น NULL ได้กรณีขาจร
    var savedName string
    var savedPhone string
    var savedAddress string

    // -------------------------------------------------------------------------
    // [1. แยก Logic ระหว่าง ลูกค้าสมาชิก vs ลูกค้าขาจร (ไม่ได้ลงทะเบียน)]
    // -------------------------------------------------------------------------
    if req.CustomerID > 0 {
        customer = &entity.Customer{}
        if err := tx.Preload("CustomerType").First(customer, req.CustomerID).Error; err != nil {
            tx.Rollback()
            return nil, errors.New("ไม่พบข้อมูลลูกค้าในระบบ")
        }

		customerIDForOrder = &req.CustomerID // กำหนด ID สมาชิกเพื่อบันทึกลง DB

		// ถ้าไม่ได้พิมพ์ชื่อชั่วคราวมา ให้ดึงชื่อจากสมาชิกใน DB
		savedName = customer.CustomerName
		if req.CustomerNameTemp != "" {
			savedName = req.CustomerNameTemp
		}

		savedPhone = customer.PhoneNumber
		if req.CustomerPhoneTemp != "" {
			savedPhone = req.CustomerPhoneTemp
		}

		savedAddress = req.CustomerAddressTemp
		customer.ShippingAddress = savedAddress
		if err := tx.Session(&gorm.Session{}).Save(customer).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("อัปเดตที่อยู่ลูกค้าล้มเหลว: %w", err)
		}
	} else {
		// กรณี: ลูกค้าขาจร (เช่น คุณสมจิต / ไม่ได้ลงทะเบียน / CustomerID == 0)
		customerIDForOrder = nil // บันทึก customer_id ลงตาราง sale_orders เป็น NULL ไม่ทับใคร 100%

		// สร้าง Object ชั่วคราวใน Memory สำหรับเช็กสิทธิ์ส่วนลด (ไม่เซฟลง DB)
		customer = &entity.Customer{
			IsDiscountEnabled: false,
			CustomerType: entity.CustomerType{
				TypeName: "GENERAL",
			},
		}

		savedName = req.CustomerNameTemp
		if savedName == "" {
			savedName = "ลูกค้าทั่วไป (หน้าร้าน)"
		}

		savedPhone = req.CustomerPhoneTemp
		savedAddress = req.CustomerAddressTemp
	}

	// ตัดความยาวเบอร์โทรไม่ให้เกิน 20 ตัวอักษร (แปลงเป็น []rune ก่อนตัด)
    runesPhone := []rune(savedPhone)
    if len(runesPhone) > 20 {
        savedPhone = string(runesPhone[:20])
    }

    // เจนเลขที่บิลขายอัตโนมัติ (เช่น INV2607200001)
    orderNumber, err := s.generateOrderNumber(tx)
    if err != nil {
        tx.Rollback()
        return nil, fmt.Errorf("ไม่สามารถสร้างเลขที่บิลอัตโนมัติได้: %w", err)
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
            return nil, fmt.Errorf("ไม่พบสินค้า ID %d", itemReq.ProductID)
        }

        if product.Quantity < itemReq.Qty {
            tx.Rollback()
            return nil, fmt.Errorf("สินค้า %s สต็อกไม่พอขาย (เหลือ %d ชิ้น)", product.Product_Name, product.Quantity)
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
            return nil, fmt.Errorf("สินค้า %s มีส่วนลดต่อชิ้น %.2f%% ซึ่งเกินกว่าเกณฑ์สูงสุดที่ยอมให้ลดได้สำหรับลูกค้าท่านนี้ (สูงสุด %.2f%%)", 
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
            return nil, fmt.Errorf("หักสต็อกสินค้า %s ล้มเหลว", product.Product_Name)
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
        return nil, fmt.Errorf("ไม่สามารถเรียกดูข้อมูลนโยบายความปลอดภัยร้านค้าได้: %w", err)
    }
    isCompany := customer.CustomerType.TypeName == "WHOLESALE" || customer.CustomerType.ID == 3
    // [CHECK]: ตรวจสอบเฉพาะส่วนลดท้ายบิลเพียวๆ ห้ามเกิน MaxExtraDiscountRate ของร้านเด็ดขาด!
    if !isCompany && billDiscountPercent > (storeConfig.MaxExtraDiscountRate + 0.01) {
        tx.Rollback()
        return nil, fmt.Errorf("ส่วนลดท้ายบิลรวม %.2f%% เกินกว่านโยบายความปลอดภัยของร้านค้าที่กำหนดไว้ (สูงสุด %.2f%%)", 
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
    // [จัดการระบบเครดิตเงินกู้ และตั้งค่าสถานะบิลเริ่มต้น (Pending/Unpaid)]
    // -------------------------------------------------------------------------
    
    // paymentMethod คือออบเจกต์ตรวจสอบช่องทางชำระเงินที่เลือก (เช่น เงินสด โอน หรือเครดิตอู่)
    paymentMethod, err := s.repo.GetPaymentMethodByID(req.PaymentMethodID)
    if err != nil {
        tx.Rollback()
        return nil, fmt.Errorf("ไม่พบช่องทางการชำระเงินในระบบ: %w", err)
    }
    if !paymentMethod.IsActive {
        tx.Rollback()
        return nil, fmt.Errorf("ช่องทางการชำระเงิน %s ถูกปิดใช้งานในขณะนี้", paymentMethod.MethodName)
    }

    var dueDate *time.Time

    // กรณีเป็น เงินเชื่อ (CREDIT) -> ตรวจสอบวงเงินและอัปเดตหนี้สะสม
    if paymentMethod.IsCredit {
        if customerIDForOrder == nil {
            tx.Rollback()
            return nil, errors.New("ลูกค้าทั่วไป/ขาจร ไม่สามารถเลือกชำระแบบซื้อเชื่อได้")
        }

        if customer.CurrentDebtAmount+totalAmount > customer.CreditLimit {
            tx.Rollback()
            return nil, fmt.Errorf("วงเงินเครดิตไม่เพียงพอ! วงเงินคงเหลือขาดไป %.2f บาท", (customer.CurrentDebtAmount+totalAmount)-customer.CreditLimit)
        }

        // คำนวณวันครบกำหนดชำระ
        storeConfig, err := s.repo.GetStoreConfig()
        if err == nil && storeConfig.MaxOverdueDays > 0 {
            calculatedDueDate := now.AddDate(0, 0, storeConfig.MaxOverdueDays)
            dueDate = &calculatedDueDate
        } else {
            // Fallback กรณีหา config ไม่เจอ (เช่น ค่าตั้งต้น 30 วัน)
            defaultDueDate := now.AddDate(0, 0, 30)
            dueDate = &defaultDueDate
        }

		// บวกยอดหนี้สะสมเพิ่มเข้าบัญชีลูกค้า
        customer.CurrentDebtAmount += totalAmount
        
		// UPDATE ยอดหนี้สะสมลูกค้าลง DB (ใน TX เดียวกัน)
        if err := tx.Session(&gorm.Session{}).Save(customer).Error; err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("อัปเดตยอดหนี้สะสมของลูกค้าล้มเหลว: %v", err)
        }
    }

    // -------------------------------------------------------------------------
    // [กำหนดสถานะและยอดชำระตามช่องทางการชำระเงิน]
    // -------------------------------------------------------------------------
    var orderStatus string = "pending"
    var paymentStatus string = "unpaid"
    var receivedAmount float64 = 0.0
    var paidAmount float64 = 0.0
    var balanceDue float64 = totalAmount
    var changeAmount float64 = 0.0

    if req.PaymentMethodID == 1 { // Cash
        orderStatus = "completed"
        paymentStatus = "paid"
        receivedAmount = req.ReceivedAmount
        paidAmount = totalAmount
        balanceDue = 0.0
        if req.ReceivedAmount > totalAmount {
            changeAmount = req.ReceivedAmount - totalAmount
        }
    } else if req.PaymentMethodID == 3 { // Credit
        orderStatus = "completed"
        paymentStatus = "unpaid"
        receivedAmount = 0.0
        paidAmount = 0.0
        balanceDue = totalAmount
        changeAmount = 0.0
    }

    order := &entity.SaleOrder{
        OrderNumber:        orderNumber,
        OrderDate:          now,
        DueDate:            dueDate,
        CustomerID:         customerIDForOrder, 
        PaymentMethodID:    &req.PaymentMethodID,
        CustomerNameTemp:   &savedName,
        CustomerPhoneTemp:  &savedPhone,
        CustomerAddressTemp: savedAddress,
        Status:             enum.OrderStatus(orderStatus),                  
        PaymentStatus:      enum.PaymentStatus(paymentStatus), 
        Subtotal:           orderSubtotalAfterItems,
        BillDiscountType:   req.BillDiscountType,
        BillDiscountValue:  req.BillDiscountValue,
        DiscountAmount:     billDiscountAmount,
        DiscountPercent:    billDiscountPercent,
        TotalDiscountItems: totalDiscountItems,
        TotalAmount:        totalAmount,
        ReceivedAmount:     receivedAmount,
        PaidAmount:         paidAmount,
        BalanceDue:         balanceDue,
        ChangeAmount:       changeAmount,
        Note:               req.Note,
        Items:              orderItems,
    }

    // สั่งเซฟลงฐานข้อมูลเพียงรอบเดียว
    if err := s.repo.CreateOrderWithTx(tx, order); err != nil {
        tx.Rollback()
        return nil, err
    }

    // สร้าง Payment Record สำหรับกรณีชำระเงินสดทันที
    if req.PaymentMethodID == 1 {
        payment := &entity.Payment{
            OrderID:         order.ID,
            PaymentMethodID: req.PaymentMethodID,
            Amount:          totalAmount,
            ReceivedAmount:  req.ReceivedAmount,
            ChangeAmount:    changeAmount,
            ReferenceNumber: fmt.Sprintf("PAY-%s-%d", order.OrderNumber, now.Unix()),
            ReceivedByID:    userID,
            PaidAt:          &now,
        }
        if err := tx.Session(&gorm.Session{}).Create(payment).Error; err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("สร้างรายการชำระเงินสดล้มเหลว: %w", err)
        }
    }

    // ทำการ Commit Transaction
    if err := tx.Commit().Error; err != nil {
        tx.Rollback()
        return nil, fmt.Errorf("Commit Error: %v", err)
    }

    // บันทึกสำเร็จ! ส่ง Object order ออกไป
    return order, nil 
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

func (s *saleService) UpdatePOSOrder(orderNumber string, req *pos.UpdateSaleOrderRequest, userID uint) (*entity.SaleOrder, error) {
	loc, err := time.LoadLocation("Asia/Bangkok")
	if err != nil {
		loc = time.Local
	}
	now := time.Now().In(loc)

	tx := s.repo.BeginTransaction()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1.  ค้นหา Order เดิมด้วย orderNumber แทน ID
	existingOrder, err := s.repo.GetOrderByOrderNumber(orderNumber) // หรือใช้ tx ดึงใน repo
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("ไม่พบรายการสั่งซื้อเลขที่ %s", orderNumber)
	}

	// Guard: ป้องกันการแก้ Order ที่ไม่ได้อยู่ในสถานะ pending
	if existingOrder.Status != "pending" {
		tx.Rollback()
		return nil, errors.New("ไม่สามารถแก้ไขรายการสั่งซื้อที่ทำรายการสำเร็จไปแล้วได้")
	}

	// -------------------------------------------------------------------------
	//  คืนยอดหนี้สะสมเก่า (ถ้า Order เดิมเคยเลือกชำระแบบซื้อเชื่อ CREDIT ไว้)
	// -------------------------------------------------------------------------
	if existingOrder.PaymentMethod != nil && existingOrder.PaymentMethod.IsCredit && existingOrder.CustomerID != nil {
		var prevCustomer entity.Customer
		if err := tx.First(&prevCustomer, *existingOrder.CustomerID).Error; err == nil {
			if prevCustomer.CurrentDebtAmount >= existingOrder.TotalAmount {
				prevCustomer.CurrentDebtAmount -= existingOrder.TotalAmount
			} else {
				prevCustomer.CurrentDebtAmount = 0
			}
			if err := tx.Session(&gorm.Session{}).Save(&prevCustomer).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("คืนยอดหนี้สะสมเดิมล้มเหลว: %w", err)
			}
		}
	}

	// 2.  คืนสต็อกสินค้า (Revert Stock) จากรายการเก่าใน Order นี้ก่อน!
	for _, oldItem := range existingOrder.Items {
		product, err := s.productRepo.GetProductByID(oldItem.ProductID)
		if err == nil {
			product.Quantity += oldItem.Qty // คืนจำนวนกลับเข้าคลัง
			if err := s.productRepo.UpdateProductWithTx(tx, product); err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("คืนสต็อกสินค้า %s ล้มเหลว", product.Product_Name)
			}
		}
	}

	// 3. ลบ OrderItems รายการเก่าออกทั้งหมดใน DB
	if err := s.repo.DeleteOrderItemsWithTx(tx, existingOrder.ID); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("ลบรายการสินค้าเดิมล้มเหลว: %w", err)
	}

	// 4. จัดการข้อมูลลูกค้า (สมาชิก vs ขาจร) จาก request ชุดใหม่ (req)
    var customer *entity.Customer
    var customerIDForOrder *uint
    
    var savedName string
    var savedPhone string
    var savedAddress string

    if req.CustomerID > 0 {
        customer = &entity.Customer{}
        if err := tx.Preload("CustomerType").First(customer, req.CustomerID).Error; err != nil {
            tx.Rollback()
            return nil, errors.New("ไม่พบข้อมูลลูกค้าชุดใหม่ในระบบ")
        }
        
        customerIDForOrder = &req.CustomerID
        
        savedName = customer.CustomerName
        if req.CustomerNameTemp != "" {
            savedName = req.CustomerNameTemp
        }
        
        savedPhone = customer.PhoneNumber
        if req.CustomerPhoneTemp != "" {
            savedPhone = req.CustomerPhoneTemp
        }

        savedAddress = req.CustomerAddressTemp
        customer.ShippingAddress = savedAddress
        if err := tx.Session(&gorm.Session{}).Save(customer).Error; err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("อัปเดตที่อยู่ลูกค้าล้มเหลว: %w", err)
        }
    } else {
        // เป็นลูกค้าทั่วไป/ขาจร
        customerIDForOrder = nil
        customer = &entity.Customer{
            IsDiscountEnabled: false,
            CustomerType:      entity.CustomerType{TypeName: "GENERAL"},
        }
        savedName = req.CustomerNameTemp
        if savedName == "" {
            savedName = "ลูกค้าทั่วไป (หน้าร้าน)"
        }
        savedPhone = req.CustomerPhoneTemp
        savedAddress = req.CustomerAddressTemp
    }

	// ตัดความยาวเบอร์โทรไม่ให้เกิน 20 ตัวอักษร
    runesPhone := []rune(savedPhone)
    if len(runesPhone) > 20 {
        savedPhone = string(runesPhone[:20])
    }

	// 5. วนลูปคำนวณ Items ชุดใหม่ + ตรวจสอบส่วนลด + ตัดสต็อกรอบใหม่
	var subtotalAmount, totalDiscountItems float64
    var newOrderItems []entity.SaleOrderItem

    for _, itemReq := range req.Items {
        product, err := s.productRepo.GetProductByID(itemReq.ProductID)
        if err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("ไม่พบสินค้า ID %d", itemReq.ProductID)
        }


        unitPrice := product.Sale_price 

        // เช็กสต็อกล่าสุด (หลังคืนสต็อกแล้ว)
        if product.Quantity < itemReq.Qty {
            tx.Rollback()
            return nil, fmt.Errorf("สินค้า %s สต็อกไม่พอขาย (เหลือ %d ชิ้น)", product.Product_Name, product.Quantity)
        }

        // คำนวณส่วนลด & เช็กเพดานส่วนลด (เปลี่ยน itemReq.UnitPrice -> unitPrice)
        var itemDiscountPercent float64
        if itemReq.DiscountType == "percentage" {
            itemDiscountPercent = itemReq.DiscountValue
        } else if itemReq.DiscountType == "amount" && unitPrice > 0 {
            itemDiscountPercent = (itemReq.DiscountValue / unitPrice) * 100
        }

        allowedMaxDiscount := product.MaxDiscountRate
        if customer.CustomerType.TypeName == "GARAGE" && customer.IsDiscountEnabled {
            allowedMaxDiscount += customer.OntopDiscountRate
        }

        if itemDiscountPercent > allowedMaxDiscount {
            tx.Rollback()
            return nil, fmt.Errorf("สินค้า %s มีส่วนลดต่อชิ้น %.2f%% ซึ่งเกินกว่าเกณฑ์สูงสุด (สูงสุด %.2f%%)",
                product.Product_Name, itemDiscountPercent, allowedMaxDiscount)
        }

        // คำนวณราคาสุทธิโดยอิงจาก unitPrice จริงจาก DB
        itemDiscountAmount := (unitPrice * itemDiscountPercent / 100) * float64(itemReq.Qty)
        finalUnitPrice := unitPrice - (itemDiscountAmount / float64(itemReq.Qty))
        itemSubtotal := finalUnitPrice * float64(itemReq.Qty)

        subtotalAmount += unitPrice * float64(itemReq.Qty)
        totalDiscountItems += itemDiscountAmount

        newOrderItems = append(newOrderItems, entity.SaleOrderItem{
            OrderNumber:     existingOrder.OrderNumber,
            ProductID:       itemReq.ProductID,
            PartNumber:      product.Part_Number,
            ProductName:     product.Product_Name,
            Qty:             itemReq.Qty,
            Unit:            product.Unit.Unit_Name,
            UnitPrice:       unitPrice, // บันทึกราคาจริงลง DB
            CostPrice:       product.Cost_price,
            DiscountType:    itemReq.DiscountType,
            DiscountValue:   itemReq.DiscountValue,
            DiscountPercent: itemDiscountPercent,
            DiscountAmount:  itemDiscountAmount,
            FinalUnitPrice:  finalUnitPrice,
            Subtotal:        itemSubtotal,
        })

        // ตัดสต็อกใหม่
        product.Quantity -= itemReq.Qty
        if err := s.productRepo.UpdateProductWithTx(tx, product); err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("หักสต็อกสินค้า %s ล้มเหลว", product.Product_Name)
        }
    }

	// 6. คำนวณส่วนลดท้ายบิลใหม่
	var billDiscountAmount, billDiscountPercent float64
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

	// เฉลี่ยส่วนลดลง Items
	var distributedBillDiscount float64
	for i := range newOrderItems {
		if orderSubtotalAfterItems > 0 {
			if i == len(newOrderItems)-1 {
				newOrderItems[i].AllocatedBillDiscount = billDiscountAmount - distributedBillDiscount
			} else {
				weight := newOrderItems[i].Subtotal / orderSubtotalAfterItems
				allocatedAmount := billDiscountAmount * weight
				allocatedAmount = float64(int(allocatedAmount*100+0.5)) / 100
				newOrderItems[i].AllocatedBillDiscount = allocatedAmount
				distributedBillDiscount += allocatedAmount
			}
		}
		newOrderItems[i].NetSubtotal = newOrderItems[i].Subtotal - newOrderItems[i].AllocatedBillDiscount
	}

	totalAmount := orderSubtotalAfterItems - billDiscountAmount

	// -------------------------------------------------------------------------
	// จัดการเช็กวิธีชำระเงิน และคำนวณเครดิต / DueDate
	// -------------------------------------------------------------------------
	paymentMethod, err := s.repo.GetPaymentMethodByID(req.PaymentMethodID)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("ไม่พบช่องทางการชำระเงินในระบบ: %w", err)
	}
	if !paymentMethod.IsActive {
		tx.Rollback()
		return nil, fmt.Errorf("ช่องทางการชำระเงิน %s ถูกปิดใช้งานในขณะนี้", paymentMethod.MethodName)
	}

	var dueDate *time.Time

	if paymentMethod.IsCredit {
		if customerIDForOrder == nil {
			tx.Rollback()
			return nil, errors.New("ลูกค้าทั่วไป/ขาจร ไม่สามารถเลือกชำระแบบซื้อเชื่อได้")
		}

		if customer.CurrentDebtAmount+totalAmount > customer.CreditLimit {
			tx.Rollback()
			return nil, fmt.Errorf("วงเงินเครดิตไม่เพียงพอ! วงเงินคงเหลือขาดไป %.2f บาท", (customer.CurrentDebtAmount+totalAmount)-customer.CreditLimit)
		}

		// คำนวณวันครบกำหนดชำระ
		storeConfig, err := s.repo.GetStoreConfig()
		if err == nil && storeConfig.MaxOverdueDays > 0 {
			calculatedDueDate := now.AddDate(0, 0, storeConfig.MaxOverdueDays)
			dueDate = &calculatedDueDate
		} else {
			defaultDueDate := now.AddDate(0, 0, 30)
			dueDate = &defaultDueDate
		}

		// บวกยอดหนี้สะสมใหม่เพิ่มเข้าบัญชีลูกค้า
		customer.CurrentDebtAmount += totalAmount

		// UPDATE ยอดหนี้สะสมลง DB
		if err := tx.Session(&gorm.Session{}).Save(customer).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("อัปเดตยอดหนี้สะสมของลูกค้าล้มเหลว: %v", err)
		}
	}

	// 7. กำหนดสถานะและยอดชำระตามช่องทางการชำระเงิน
	var orderStatus string = "pending"
	var paymentStatus string = "unpaid"
	var receivedAmount float64 = 0.0
	var paidAmount float64 = 0.0
	var balanceDue float64 = totalAmount
	var changeAmount float64 = 0.0

	if req.PaymentMethodID == 1 { // Cash
		orderStatus = "completed"
		paymentStatus = "paid"
		receivedAmount = req.ReceivedAmount
		paidAmount = totalAmount
		balanceDue = 0.0
		if req.ReceivedAmount > totalAmount {
			changeAmount = req.ReceivedAmount - totalAmount
		}
	} else if req.PaymentMethodID == 3 { // Credit
		orderStatus = "completed"
		paymentStatus = "unpaid"
		receivedAmount = 0.0
		paidAmount = 0.0
		balanceDue = totalAmount
		changeAmount = 0.0
	}

	existingOrder.CustomerID = customerIDForOrder
	existingOrder.PaymentMethodID = &req.PaymentMethodID
	existingOrder.PaymentMethod = nil // ล้าง pointer พรีโหลดเดิมออก เพื่อป้องกัน GORM เขียนทับ foreign key
	existingOrder.DueDate = dueDate
	existingOrder.CustomerNameTemp = &savedName
	existingOrder.CustomerPhoneTemp = &savedPhone
	existingOrder.CustomerAddressTemp = savedAddress
	existingOrder.Status = enum.OrderStatus(orderStatus)
	existingOrder.PaymentStatus = enum.PaymentStatus(paymentStatus)
	existingOrder.Subtotal = orderSubtotalAfterItems
	existingOrder.BillDiscountType = req.BillDiscountType
	existingOrder.BillDiscountValue = req.BillDiscountValue
	existingOrder.DiscountAmount = billDiscountAmount
	existingOrder.DiscountPercent = billDiscountPercent
	existingOrder.TotalDiscountItems = totalDiscountItems
	existingOrder.TotalAmount = totalAmount
	existingOrder.ReceivedAmount = receivedAmount
	existingOrder.PaidAmount = paidAmount
	existingOrder.BalanceDue = balanceDue
	existingOrder.ChangeAmount = changeAmount
	existingOrder.Note = req.Note
	existingOrder.Items = newOrderItems

	// 8. Save ลง DB
	if err := s.repo.UpdateOrderWithTx(tx, existingOrder); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("อัปเดตข้อมูลออเดอร์ล้มเหลว: %w", err)
	}

	// สร้างหรืออัปเดต Payment Record สำหรับกรณีชำระเงินสดทันที
	if req.PaymentMethodID == 1 {
		var payment entity.Payment
		err := tx.Where("order_id = ?", existingOrder.ID).First(&payment).Error
		if err != nil {
			// สร้างใหม่
			payment = entity.Payment{
				OrderID:         existingOrder.ID,
				PaymentMethodID: req.PaymentMethodID,
				Amount:          totalAmount,
				ReceivedAmount:  req.ReceivedAmount,
				ChangeAmount:    changeAmount,
				ReferenceNumber: fmt.Sprintf("PAY-%s-%d", existingOrder.OrderNumber, now.Unix()),
				ReceivedByID:    userID,
				PaidAt:          &now,
			}
			if err := tx.Create(&payment).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("สร้างรายการชำระเงินสดล้มเหลว: %w", err)
			}
		} else {
			// อัปเดตของเดิม
			payment.PaymentMethodID = req.PaymentMethodID
			payment.Amount = totalAmount
			payment.ReceivedAmount = req.ReceivedAmount
			payment.ChangeAmount = changeAmount
			payment.PaidAt = &now
			if err := tx.Save(&payment).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("อัปเดตรายการชำระเงินสดล้มเหลว: %w", err)
			}
		}
	}

	// ถ้าเปลี่ยนวิธีชำระเงินเป็น Credit (3) ให้ลบประวัติชำระเงินของบิล QR/Cash เดิมออก
	if req.PaymentMethodID == 3 {
		if err := tx.Where("order_id = ?", existingOrder.ID).Delete(&entity.Payment{}).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("ลบประวัติการชำระเงินเดิมล้มเหลว: %w", err)
		}
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("Commit Error: %v", err)
	}

	return existingOrder, nil
}