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
    CreatePOSOrder(req *pos.CreateSaleOrderRequest) error
    GetCustomerTypes() ([]entity.CustomerType, error)
    SearchCustomers(searchQuery string) ([]customerDto.CustomerResponse, error)
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

func (s *saleService) CreatePOSOrder(req *pos.CreateSaleOrderRequest) error {
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

    // ดึงข้อมูลลูกค้า
    customer, err := s.customerRepo.GetCustomerByID(req.CustomerID)
    if err != nil {
        tx.Rollback()
        return errors.New("ไม่พบข้อมูลลูกค้าในระบบ")
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

        // finalDiscountPercent คือตัวแปรสะสม "เปอร์เซ็นต์ส่วนลดรวมของไอเทมชิ้นนี้" (Layer 1 + Layer 2)
        var finalDiscountPercent float64

        // ตรวจสอบประเภทส่วนลดแถวที่หน้าบ้านกดเลือกส่งมา
        if itemReq.DiscountType == "percentage" {
            // ถ้าเลือกเป็น % ก็ดึงค่าดิบ (เช่น เลข 2.00) มาตั้งต้นเป็นเปอร์เซ็นต์ลดได้เลย
            finalDiscountPercent = itemReq.DiscountValue
        } else if itemReq.DiscountType == "amount" && itemReq.UnitPrice > 0 {
            // ถ้าเลือกลดเป็นบาท (เช่น ลดชิ้นละ 20 บาท) ต้องแปลงกลับเป็น % เพื่อเอาไปผสมสูตรต่อ
            // สูตร: (เงินส่วนลดต่อชิ้น / ราคาเต็มต่อชิ้น) * 100
            finalDiscountPercent = (itemReq.DiscountValue / itemReq.UnitPrice) * 100
        }

        // [LAYER 2 & DYNAMIC VALIDATION]: เอาโควตาส่วนลดสินค้า + สิทธิ์ออนท็อปอู่มารวมกันเป็นเพดานใหม่
        allowedMaxDiscount := product.MaxDiscountRate // ตั้งต้นจากเพดานสินค้า (เช่น 2%)

        if customer.CustomerType.TypeName == "GARAGE" && customer.IsDiscountEnabled {
            // บวกส่วนลดออนท็อปประจำอู่นี้เข้าไป (+3%)
            finalDiscountPercent += customer.OntopDiscountRate
            
            // ขยายเพดานสูงสุดของสินค้ารายชิ้นนี้พ่วงสิทธิ์ของอู่เข้าไปด้วย (เช่น 2% + 3% = 5%)
            allowedMaxDiscount += customer.OntopDiscountRate
        }

        // ตรวจสอบกับเพดานสะสมผสมสิทธิ์แล้ว (เช่น 3% ไม่เกิน 5% ผ่านฉลุย!)
        if finalDiscountPercent > allowedMaxDiscount {
            tx.Rollback()
            return fmt.Errorf("สินค้า %s มีส่วนลดรวม %.2f%% ซึ่งเกินกว่าเกณฑ์สูงสุดที่ยอมให้ลดได้สำหรับอู่นี้ (สูงสุด %.2f%%)", 
                product.Product_Name, finalDiscountPercent, allowedMaxDiscount)
        }

        // itemDiscountAmount คือมูลค่าส่วนลดรวมของแถวนี้คิดเป็นเงินบาท
        // สูตร: (ราคาเต็มต่อหน่วย × %ส่วนลดรวม / 100) × จำนวนชิ้นที่สั่งซื้อ
        itemDiscountAmount := (itemReq.UnitPrice * finalDiscountPercent / 100) * float64(itemReq.Qty)
        
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
            DiscountType:    "percentage", // บังคับเซฟเป็นเปอร์เซ็นต์รวมเพื่อง่ายต่อการตรวจสอบย้อนหลัง
            DiscountValue:   finalDiscountPercent,
            DiscountPercent: finalDiscountPercent,
            DiscountAmount:  itemDiscountAmount,
            FinalUnitPrice:  finalUnitPrice,
            Subtotal:        itemSubtotal, // ยอดคงเหลือประจำแถว (หลังหักลดรายชิ้น แต่ก่อนหักลดท้ายบิล)
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

    // 🔍 ดึงนโยบายของร้านค้าจากฐานข้อมูลมาตรวจสอบเพดานท้ายบิลตรง ๆ
    storeConfig, err := s.repo.GetStoreConfig()
    if err != nil {
        tx.Rollback()
        return fmt.Errorf("ไม่สามารถเรียกดูข้อมูลนโยบายความปลอดภัยร้านค้าได้: %w", err)
    }
    isCompany := customer.CustomerType.TypeName == "WHOLESALE" || customer.CustomerType.ID == 3
    // 🚨 [CHECK]: ตรวจสอบเฉพาะส่วนลดท้ายบิลเพียวๆ ห้ามเกิน MaxExtraDiscountRate ของร้านเด็ดขาด!
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
    var paidAmount float64   // ยอดเงินสดที่ได้รับจริงในบิลนี้

    // ตรวจสอบเงื่อนไขว่าเป็นการเลือกชำระแบบ "ซื้อเชื่อ / แปะโป้งเครดิตอู่" ใช่ไหม
    if paymentMethod.IsCredit {
        // เช็คว่า หนี้เก่าสะสม + หนี้ใหม่บิลนี้ มันทะลุเพดานวงเงินที่เถ้าแก่อนุมัติไว้ให้ไหม
        if customer.CurrentDebtAmount+totalAmount > customer.CreditLimit {
            tx.Rollback()
            return fmt.Errorf("วงเงินเครดิตไม่เพียงพอ! วงเงินคงเหลือขาดไป %.2f บาท", (customer.CurrentDebtAmount+totalAmount)-customer.CreditLimit)
        }

		paymentStatus = "unpaid" // สถานะ: ยังค้างชำระ
		balanceDue = totalAmount // ยอดค้างชำระ = ยอดสุทธิทั้งบิล
		paidAmount = 0.00        // ยังไม่ได้รับเงิน

		// บวกยอดหนี้สะสมเพิ่มเข้าบัญชีลูกค้า
        customer.CurrentDebtAmount += totalAmount
        
		// UPDATE ยอดหนี้สะสมลูกค้าลง DB (ใน TX เดียวกัน)
        if err := tx.Session(&gorm.Session{}).Save(customer).Error; err != nil {
            tx.Rollback()
            return fmt.Errorf("อัปเดตยอดหนี้สะสมของลูกค้าล้มเหลว: %v", err)
        }
    } else {
		// กรณี: ชำระเงินสด (หรือวิธีอื่นที่ไม่ใช่เครดิต)
		paymentStatus = "paid"   // สถานะ: ชำระแล้ว
		balanceDue = 0.00        // ไม่มียอดค้างชำระ
		paidAmount = totalAmount // ยอดที่รับมา = ยอดสุทธิทั้งบิล
    }

	// 8. ประกอบ SaleOrder Entity เพื่อบันทึก
    order := &entity.SaleOrder{
        OrderNumber:        orderNumber,
        OrderDate:          time.Now(),
        CustomerID:         req.CustomerID,
        Status:             "completed",
        PaymentStatus:      enum.PaymentStatus(paymentStatus),
        Subtotal:           orderSubtotalAfterItems, 
        BillDiscountType:   req.BillDiscountType,
        BillDiscountValue:  req.BillDiscountValue,
        DiscountAmount:     billDiscountAmount,
        DiscountPercent:    billDiscountPercent,
        TotalDiscountItems: totalDiscountItems,
        TotalAmount:        totalAmount,
        PaidAmount:         paidAmount,
        BalanceDue:         balanceDue,
        ChangeAmount:       0.00,
        Note:               req.Note,
        Items:              orderItems, // ผูกอาเรย์สินค้าลูกเข้าไปด้วย GORM จะสั่งบันทึกตารางไอเทมพ่วงให้เองอัตโนมัติ
    }

	// 9. สั่งเซฟลงฐานข้อมูลผ่าน Repository ด้วยท่อ Transaction
    if err := s.repo.CreateOrderWithTx(tx, order); err != nil {
        tx.Rollback()
        return err
    }

    // สั่ง "Commit" เพื่อแกะครั่งปิดผนึกท่อ Transaction บันทึกข้อมูลลงฮาร์ดดิสก์แบบถาวรชั่วลูกชั่วหลาน
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