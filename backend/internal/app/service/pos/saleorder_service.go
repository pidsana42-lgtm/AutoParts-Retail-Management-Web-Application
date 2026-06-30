package pos

import (
	"backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	customerRepo "backend/internal/app/repository/customer"
	posRepo "backend/internal/app/repository/pos"
	productRepo "backend/internal/app/repository/pos"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"time"
)

type SaleService interface {
	CreatePOSOrder(req *pos.CreateSaleOrderRequest) error
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
	// 1. เปิดระบบ Transaction มัดรวมคำสั่ง (ถ้ามีจุดไหนพัง จะได้ Rollback ทุกอย่างกลับไปเหมือนเดิม)
	tx := s.repo.BeginTransaction()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 2. ดึง StoreConfig ขึ้นมาเตรียมเช็คสิทธิ์ส่วนลด
	config, err := s.repo.GetStoreConfig()
	if err != nil {
		tx.Rollback()
		return errors.New("ไม่สามารถดึงค่าคอนฟิกร้านค้าได้")
	}

	// เจนเลขที่ออเดอร์อัตโนมัติ (INV + วันที่ + เลขรัน)
    orderNumber, err := s.generateOrderNumber(tx)
    if err != nil {
        tx.Rollback()
        return fmt.Errorf("ไม่สามารถสร้างเลขที่บิลอัตโนมัติได้: %w", err)
    }

	// 3. ดึงข้อมูลลูกค้าขึ้นมาตรวจสอบ CreditLimit, CurrentDebtAmount
	customer, err := s.customerRepo.GetCustomerByID(req.CustomerID)
	if err != nil {
		tx.Rollback()
		return errors.New("ไม่พบข้อมูลลูกค้าในระบบ")
	}

	//ตัวแปรสะสมระหว่างวนลูปสินค้า
	var subtotalAmount float64            // ยอดรวมราคาเต็ม (ก่อนหักส่วนลดทุกประเภท)
	var totalDiscountItems float64        // ยอดรวมส่วนลดรายชิ้นสะสมทุกรายการ
	var orderItems []entity.SaleOrderItem // Slice เก็บรายการสินค้าที่จะบันทึกลง DB

	// 4. วนลูปตรวจสอบและคำนวณรายการสินค้าทีละชิ้น
	for _, itemReq := range req.Items {

		// 4.1 ดึงข้อมูลสินค้าจากฐานข้อมูล
		product, err := s.productRepo.GetProductByID(itemReq.ProductID)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("ไม่พบสินค้า ID %d", itemReq.ProductID)
		}

		// 4.2 ตรวจสอบสต็อกคงเหลือ
		if product.Quantity < itemReq.Qty {
			tx.Rollback()
			return fmt.Errorf("สินค้า %s สต็อกไม่พอขาย (เหลือ %d ชิ้น)", product.Product_Name, product.Quantity)
		}

		// 4.3 ประกาศตัวแปรส่วนลดรายบรรทัด
		var itemDiscountAmount float64  // ส่วนลดรายชิ้นคิดเป็น "บาท" (รวมทุกชิ้นในบรรทัดนี้)
		var itemDiscountPercent float64 // ส่วนลดรายชิ้นคิดเป็น "%"

		// 4.4 คำนวณส่วนลดตามประเภทที่เลือก
		if itemReq.DiscountType == "percentage" {
			// 1. ห้ามกรอกเปอร์เซ็นต์ส่วนลดรายบรรทัดเกิน StoreConfig
			if itemReq.DiscountValue > config.MaxItemDiscountRate {
				// กรณี: ส่วนลดแบบเปอร์เซ็นต์ (เช่น ลด 10%)
				tx.Rollback()
				return fmt.Errorf("สินค้า %s ให้ส่วนลด %.2f%% เกินกำหนดสูงสุดของร้าน (สูงสุด %.2f%%)", product.Product_Name, itemReq.DiscountValue, config.MaxItemDiscountRate)
			}
			itemDiscountPercent = itemReq.DiscountValue // เก็บ % ส่วนลด
			// คำนวณเงินส่วนลด: (ราคาต่อชิ้น × % ส่วนลด / 100) × จำนวนชิ้น
			// เช่นแบบว่า ราคา 100 บาท ลด 10% จำนวน 3 ชิ้น → ส่วนลด = (100×10/100)×3 = 30 บาท
			itemDiscountAmount = (itemReq.UnitPrice * itemDiscountPercent / 100) * float64(itemReq.Qty)

		} else if itemReq.DiscountType == "amount" {
            // กรณี: ส่วนลดแบบจำนวนเงิน (ค่าที่ส่งมาจากหน้าบ้านคือส่วนลดต่อชิ้น)
            discountPerUnit := itemReq.DiscountValue
            
            // คำนวณส่วนลดรวมของบรรทัดนี้จริง ๆ: ส่วนลดต่อชิ้น × จำนวนชิ้น
            itemDiscountAmount = discountPerUnit * float64(itemReq.Qty)

            // แปลงเงินบาทต่อชิ้นกลับเป็น % โดยเทียบกับราคาเต็มต่อชิ้นตรง ๆ (แม่นยำที่สุด)
            if itemReq.UnitPrice > 0 {
                // สูตร: (ส่วนลดต่อชิ้น / ราคาเต็มต่อชิ้น) × 100
                itemDiscountPercent = (discountPerUnit / itemReq.UnitPrice) * 100
            }

            // ตรวจว่าส่วนลดที่แปลงเป็น % แล้วเกินกำหนดไหม
            if itemDiscountPercent > config.MaxItemDiscountRate {
                tx.Rollback()
                return fmt.Errorf("สินค้า %s ให้ส่วนลดคิดเป็น %.2f%% เกินกำหนดสูงสุดของร้าน (สูงสุด %.2f%%)", product.Product_Name, itemDiscountPercent, config.MaxItemDiscountRate)
            }
        }
		// 4.5 คำนวณราคาสุทธิต่อชิ้นและยอดรวม
		// ราคาต่อชิ้นหลังหักส่วนลด: ราคาเต็ม - (ส่วนลดรวมบรรทัด / จำนวนชิ้น)
		// ตัวอย่าง: ราคา 100 ลดไป 30 บาท (3 ชิ้น) → finalUnitPrice = 100 - (30/3) = 90 บาท/ชิ้น
		finalUnitPrice := itemReq.UnitPrice - (itemDiscountAmount / float64(itemReq.Qty))
		// ยอดรวมบรรทัดนี้: ราคาสุทธิต่อชิ้น × จำนวนชิ้น
		// ตัวอย่าง: 90 × 3 = 270 บาท
		itemSubtotal := finalUnitPrice * float64(itemReq.Qty)

		// 4.6 สะสมยอดรวมเพื่อใช้คำนวณส่วนลดท้ายบิล
		subtotalAmount += itemReq.UnitPrice * float64(itemReq.Qty) // ยอดรวมราคาเต็ม
		totalDiscountItems += itemDiscountAmount                   // ผลรวมส่วนลดรายชิ้นสะสม

		// 4.7 สร้าง SaleOrderItem และเพิ่มเข้า Slice ของรายการสินค้าก่อนบันทึกลง DB
		orderItems = append(orderItems, entity.SaleOrderItem{
			OrderNumber:     orderNumber,            // เลขที่บิล (เพื่อให้ FK กับ SaleOrder)
			ProductID:       itemReq.ProductID,      // รหัสสินค้า
			PartNumber:      product.Part_Number,    // เลขพาร์ทสินค้า (ดึงจาก DB)
			ProductName:     product.Product_Name,   // ชื่อสินค้า (snapshot ณ วันขาย)
			Qty:             itemReq.Qty,            // จำนวนที่ขาย
			Unit:            product.Unit.Unit_Name, // หน่วยนับ (เช่น ชิ้น, กล่อง)
			UnitPrice:       itemReq.UnitPrice,      // ราคาขายต่อชิ้น (ราคาเต็ม)
			CostPrice:       product.Cost_price,     // ราคาทุน (สำหรับคำนวณกำไรขาดทุน)
			DiscountType:    itemReq.DiscountType,   // ประเภทส่วนลด (percentage/amount)
			DiscountValue:   itemReq.DiscountValue,  // ค่าส่วนลดที่กรอก (ตัวเลขดิบ)
			DiscountPercent: itemDiscountPercent,    // ส่วนลดคิดเป็น % (เก็บทั้ง 2 แบบ)
			DiscountAmount:  itemDiscountAmount,     // ส่วนลดคิดเป็นบาท (เก็บทั้ง 2 แบบ)
			FinalUnitPrice:  finalUnitPrice,         // ราคาสุทธิต่อชิ้นหลังหักส่วนลด
			Subtotal:        itemSubtotal,           // ยอดรวมบรรทัดนี้หลังหักส่วนลดแล้ว
		})

		// 4.8 ตัดสต็อกสินค้าทันที (ภายใน Transaction เดียวกัน)
		product.Quantity -= itemReq.Qty
		if err := s.productRepo.UpdateProductWithTx(tx, product); err != nil {
			tx.Rollback()
			return fmt.Errorf("หักสต็อกสินค้า %s ล้มเหลว", product.Product_Name)
		}
	}

	// 5. คำนวณส่วนลดท้ายบิลรวม (Bill Discount)
    var billDiscountAmount float64  // ส่วนลดท้ายบิลคิดเป็น "บาท"
    var billDiscountPercent float64 // ส่วนลดท้ายบิลคิดเป็น "%"

    if req.BillDiscountType == "percentage" {
        if req.BillDiscountValue > config.MaxExtraDiscountRate {
            tx.Rollback()
            return fmt.Errorf("ส่วนลดท้ายบิล %.2f%% เกินกำหนดสูงสุดของร้าน (สูงสุด %.2f%%)", req.BillDiscountValue, config.MaxExtraDiscountRate)
        }
        billDiscountPercent = req.BillDiscountValue
        billDiscountAmount = (subtotalAmount - totalDiscountItems) * billDiscountPercent / 100

    } else if req.BillDiscountType == "amount" {
        billDiscountAmount = req.BillDiscountValue
        if subtotalAmount > 0 {
            billDiscountPercent = (billDiscountAmount / (subtotalAmount - totalDiscountItems)) * 100
        }
        if billDiscountPercent > config.MaxExtraDiscountRate {
            tx.Rollback()
            return fmt.Errorf("ส่วนลดท้ายบิลคิดเป็น %.2f%% เกินกำหนดสูงสุดของร้าน (สูงสุด %.2f%%)", billDiscountPercent, config.MaxExtraDiscountRate)
        }
    }

    if subtotalAmount > 0 {
        // 1. คำนวณหาผลรวมของส่วนลดทุกประเภทในบิลนี้ (ลดรายชิ้นสะสม + ลดท้ายบิล)
        combinedTotalDiscount := totalDiscountItems + billDiscountAmount

        // 2. แปลงผลรวมส่วนลดทั้งหมดกลับมาเป็นเปอร์เซ็นต์เมื่อเทียบกับ "ราคารวมราคาเต็มก่อนลด"
        // สูตร: (ส่วนลดทั้งหมด / ยอดรวมราคาเต็ม) × 100
        actualTotalDiscountRate := (combinedTotalDiscount / subtotalAmount) * 100

        // 3. ตั้งเกณฑ์เพดานรวม (สมมติใช้สิทธิ์ตามตัวเลขสูงสุดใน storeconfig)
        // เพื่อความยืดหยุ่น จะใช้ config.MaxItemDiscountRate (เช่น 2%) มาเป็นเกณฑ์สูงสุดของทั้งบิล
        allowedGlobalMaxRate := config.MaxItemDiscountRate

        // 4. ถ้าเปอร์เซ็นต์รวมส่วนลดจริงดันสูงกว่ากฎเหล็กของอู่ -> สั่ง Rollback ทันที!
        if actualTotalDiscountRate > allowedGlobalMaxRate {
            tx.Rollback()
            return fmt.Errorf(
                "ไม่สามารถอนุมัติบิลได้! ส่วนลดรายชิ้นรวมกับส่วนลดท้ายบิลคิดเป็น %.2f%% ซึ่งเกินเกณฑ์เพดานรวมสูงสุดของร้านที่ยอมให้ลดได้ (สูงสุด %.2f%% ของมูลค่าบิล)", 
                actualTotalDiscountRate, 
                allowedGlobalMaxRate,
            )
        }
    }

	// 6. คำนวณยอดสุทธิทั้งบิล
	// สูตร: (ราคาเต็มรวม - ส่วนลดรายชิ้นรวม) - ส่วนลดท้ายบิล = ยอดที่ลูกค้าต้องจ่ายจริง
	// ตัวอย่าง: (2000 - 200) - 90 = 1710 บาท
	totalAmount := (subtotalAmount - totalDiscountItems) - billDiscountAmount

	// 7. จัดการตามประเภทการชำระเงิน
    paymentMethod, err := s.repo.GetPaymentMethodByID(req.PaymentMethodID)
    if err != nil {
        tx.Rollback()
        return fmt.Errorf("ไม่พบช่องทางการชำระเงินในระบบ: %w", err)
    }

    if !paymentMethod.IsActive {
        tx.Rollback()
        return fmt.Errorf("ช่องทางการชำระเงิน %s ถูกปิดใช้งานในขณะนี้", paymentMethod.MethodName)
    }

    isCreditPayment := paymentMethod.IsCredit

	// ประกาศตัวแปรสถานะการชำระเงิน
	var paymentStatus string // "paid" = ชำระแล้ว, "unpaid" = ค้างชำระ
	var balanceDue float64   // ยอดที่ยังค้างชำระ
	var paidAmount float64   // ยอดที่ชำระแล้ว

	if isCreditPayment {
		// กรณี: ซื้อเชื่อ (เครดิต)

		// ตรวจสอบวงเงินเครดิต: หนี้เดิม + บิลใหม่ ต้องไม่เกินวงเงินที่กำหนด
		// ตัวอย่าง: หนี้เดิม 3000 + บิลใหม่ 1710 = 4710 เกินวงเงิน 4500 -> ปฏิเสธ
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
		OrderNumber:        orderNumber,                   // เลขที่บิล (สร้างจาก Frontend หรือ System)
		OrderDate:          time.Now(),                        // วันเวลาที่ทำรายการ (ใช้เวลาเซิร์ฟเวอร์)
		CustomerID:         req.CustomerID,                    // รหัสลูกค้า
		Status:             "completed",                       // สถานะออเดอร์: เสร็จสิ้น
		PaymentStatus:      enum.PaymentStatus(paymentStatus), // แปลง string → enum ก่อนเก็บ
		Subtotal:           subtotalAmount,                    // ยอดรวมราคาเต็ม (ก่อนลดทุกประเภท)
		BillDiscountType:   req.BillDiscountType,              // ประเภทส่วนลดท้ายบิล
		BillDiscountValue:  req.BillDiscountValue,             // ค่าส่วนลดท้ายบิล (ตัวเลขดิบ)
		DiscountAmount:     billDiscountAmount,                // ส่วนลดท้ายบิลคิดเป็นบาท
		DiscountPercent:    billDiscountPercent,               // ส่วนลดท้ายบิลคิดเป็น %
		TotalDiscountItems: totalDiscountItems,                // ยอดรวมส่วนลดรายชิ้นทุกบรรทัด
		TotalAmount:        totalAmount,                       // ยอดสุทธิที่ลูกค้าจ่ายจริง
		PaidAmount:         paidAmount,                        // ยอดที่ชำระแล้ว
		BalanceDue:         balanceDue,                        // ยอดที่ยังค้างชำระ
		ChangeAmount:       0.00,                              // เงินทอน (TODO: คำนวณจาก CashReceived - TotalAmount)
		Note:               req.Note,                          // หมายเหตุ
		Items:              orderItems,                        // รายการสินค้าทั้งหมด (GORM จะ INSERT ลูกพร้อมพ่อ)
	}

	// 9. สั่งเซฟลงฐานข้อมูลผ่าน Repository ด้วยท่อ Transaction
	if err := s.repo.CreateOrderWithTx(tx, order); err != nil {
		tx.Rollback()
		return err
	}

	// 10. Commit Transaction เพื่อยืนยันการบันทึกทั้งหมด
	errCommit := tx.Commit().Error
	if errCommit != nil {
		tx.Rollback()
		return fmt.Errorf("ไม่สามารถเซฟยืนยันข้อมูลลงเบสได้ (Commit Error): %v", errCommit)
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