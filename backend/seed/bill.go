package seed

// import (
// 	"backend/internal/app/entity"
// 	"fmt"
// 	"time"
// 	"gorm.io/gorm"
// )

// func Bill(db *gorm.DB) error {
// 	// 1. ดึงข้อมูลที่จำเป็นที่มีอยู่แล้วในระบบ

// 	// ดึง Supplier ที่มีอยู่
// 	var suppliers []entity.Supplier
// 	if err := db.Limit(2).Find(&suppliers).Error; err != nil || len(suppliers) == 0 {
// 		return fmt.Errorf("suppliers not found, please run Supplier seed first: %w", err)
// 	}

// 	// ดึง User สำหรับ VerifiedBy
// 	var verifier entity.User
// 	if err := db.Where("username = ?", "owner").First(&verifier).Error; err != nil {
// 		return fmt.Errorf("verifier user not found, please run User seed first: %w", err)
// 	}

// 	// ดึง BillImage ที่มีอยู่
// 	var billImages []entity.BillImage
// 	if err := db.Limit(3).Find(&billImages).Error; err != nil || len(billImages) == 0 {
// 		return fmt.Errorf("bill images not found, please run BillImage seed first: %w", err)
// 	}

// 	// ดึง PO ที่มีอยู่
// 	var purchaseOrders []entity.PO
// 	if err := db.Limit(3).Find(&purchaseOrders).Error; err != nil || len(purchaseOrders) == 0 {
// 		return fmt.Errorf("purchase orders not found, please run PO seed first: %w", err)
// 	}

// 	// ดึง Products ที่มีอยู่
// 	var products []entity.Product
// 	if err := db.Limit(3).Find(&products).Error; err != nil || len(products) == 0 {
// 		return fmt.Errorf("products not found, please run Product seed first: %w", err)
// 	}

// 	// 2. สร้าง Bills
// 	now := time.Now()
// 	bills := []entity.Bill{
// 		{
// 			TotalAmount:   150000.00,
// 			BillNo:        "BILL-2024-001",
// 			DueDate:       now.AddDate(0, 0, 30),
// 			TransportBy:   "Kerry Express",
// 			SupplierID:    suppliers[0].ID,
// 			Subtotal:      140186.92,
// 			BillImageID:   billImages[0].ID,
// 			DiscountTotal: 5000.00,
// 			CreditTerm:    "30 วัน",
// 			VatAmount:     9813.08,
// 			GrandTotal:    150000.00,
// 			PaymentStatus: "PENDING",
// 			IsVerified:    true,
// 			VerifiedBy:    verifier.ID,
// 			OCRText:       "บิลเลขที่: BILL-2024-001\nรวมทั้งสิ้น: 150,000.00 บาท",
// 			POID:          purchaseOrders[0].ID,
// 			EvidenceFileURL: "https://example.com/evidence/bill-001.pdf",
// 			EvidenceUploadedAt: now,
// 		},
// 		{
// 			TotalAmount:   85000.00,
// 			BillNo:        "BILL-2024-002",
// 			DueDate:       now.AddDate(0, 0, 45),
// 			TransportBy:   "Flash Express",
// 			SupplierID:    suppliers[0].ID, // ใช้ supplier เดียวกันถ้ามีแค่ตัวเดียว หรือ suppliers[1] ถ้ามี 2 ตัว
// 			Subtotal:      79439.25,
// 			BillImageID:   billImages[1].ID,
// 			DiscountTotal: 2000.00,
// 			CreditTerm:    "45 วัน",
// 			VatAmount:     5560.75,
// 			GrandTotal:    85000.00,
// 			PaymentStatus: "PENDING",
// 			IsVerified:    true,
// 			VerifiedBy:    verifier.ID,
// 			OCRText:       "บิลเลขที่: BILL-2024-002\nรวมทั้งสิ้น: 85,000.00 บาท",
// 			POID:          purchaseOrders[1].ID,
// 			EvidenceFileURL: "https://example.com/evidence/bill-002.pdf",
// 			EvidenceUploadedAt: now,
// 		},
// 		{
// 			TotalAmount:   120000.00,
// 			BillNo:        "BILL-2024-003",
// 			DueDate:       now.AddDate(0, 0, 60),
// 			TransportBy:   "บริษัทขนส่งเอง",
// 			SupplierID:    suppliers[0].ID,
// 			Subtotal:      112149.53,
// 			BillImageID:   billImages[2].ID,
// 			DiscountTotal: 3000.00,
// 			CreditTerm:    "60 วัน",
// 			VatAmount:     7850.47,
// 			GrandTotal:    120000.00,
// 			PaymentStatus: "PAID",
// 			IsVerified:    true,
// 			VerifiedBy:    verifier.ID,
// 			OCRText:       "บิลเลขที่: BILL-2024-003\nรวมทั้งสิ้น: 120,000.00 บาท",
// 			POID:          purchaseOrders[2].ID,
// 			EvidenceFileURL: "https://example.com/evidence/bill-003.pdf",
// 			EvidenceUploadedAt: now.AddDate(0, 0, -5),
// 		},
// 	}

// 	for i, bill := range bills {
// 		var existingBill entity.Bill
// 		err := db.Where("bill_no = ?", bill.BillNo).First(&existingBill).Error

// 		if err == gorm.ErrRecordNotFound {
// 			// สร้าง Bill ใหม่
// 			if err := db.Create(&bill).Error; err != nil {
// 				return fmt.Errorf("failed to seed bill %s: %w", bill.BillNo, err)
// 			}

// 			// สร้าง BillItems สำหรับแต่ละ Bill
// 			billItems := createBillItemsForBill(bill.ID, i, products)
// 			for _, item := range billItems {
// 				if err := db.Create(&item).Error; err != nil {
// 					return fmt.Errorf("failed to seed bill item for %s: %w", bill.BillNo, err)
// 				}
// 			}

// 			fmt.Printf("Created Bill: %s with %d items\n", bill.BillNo, len(billItems))
// 		} else if err != nil {
// 			return fmt.Errorf("failed to check existing bill %s: %w", bill.BillNo, err)
// 		}
// 	}

// 	return nil
// }

// // ฟังก์ชันช่วยสร้าง BillItems
// func createBillItemsForBill(billID uint, billIndex int, products []entity.Product) []entity.BillItem {
// 	items := []entity.BillItem{}

// 	// Bill แรก: 3 items
// 	if billIndex == 0 {
// 		if len(products) > 0 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       1,
// 				CompanyProductCode: products[0].Product_Code,
// 				CompanyProductName: products[0].Product_Name,
// 				OrderQuantity:      50,
// 				Unit:               "ชิ้น",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       870.00,
// 				DiscountAmount:     2000.00,
// 				NetAmount:          41500.00,
// 				IsFreebie:          false,
// 				Remark:             "สินค้าคุณภาพสูง",
// 				ProductID:          products[0].ID,
// 			})
// 		}
// 		if len(products) > 1 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       2,
// 				CompanyProductCode: products[1].Product_Code,
// 				CompanyProductName: products[1].Product_Name,
// 				OrderQuantity:      100,
// 				Unit:               "ชิ้น",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       240.00,
// 				DiscountAmount:     1000.00,
// 				NetAmount:          23000.00,
// 				IsFreebie:          false,
// 				Remark:             "",
// 				ProductID:          products[1].ID,
// 			})
// 		}
// 		if len(products) > 2 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       3,
// 				CompanyProductCode: products[2].Product_Code,
// 				CompanyProductName: products[2].Product_Name,
// 				OrderQuantity:      200,
// 				Unit:               "ลิตร",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       110.00,
// 				DiscountAmount:     2000.00,
// 				NetAmount:          20000.00,
// 				IsFreebie:          false,
// 				Remark:             "น้ำมันเครื่องสังเคราะห์แท้",
// 				ProductID:          products[2].ID,
// 			})
// 		}
// 	}

// 	// Bill ที่สอง: 2 items
// 	if billIndex == 1 {
// 		if len(products) > 0 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       1,
// 				CompanyProductCode: products[0].Product_Code,
// 				CompanyProductName: products[0].Product_Name,
// 				OrderQuantity:      30,
// 				Unit:               "ชิ้น",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       870.00,
// 				DiscountAmount:     1000.00,
// 				NetAmount:          25100.00,
// 				IsFreebie:          false,
// 				Remark:             "",
// 				ProductID:          products[0].ID,
// 			})
// 		}
// 		if len(products) > 1 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       2,
// 				CompanyProductCode: products[1].Product_Code,
// 				CompanyProductName: products[1].Product_Name,
// 				OrderQuantity:      80,
// 				Unit:               "ชิ้น",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       240.00,
// 				DiscountAmount:     1000.00,
// 				NetAmount:          18200.00,
// 				IsFreebie:          false,
// 				Remark:             "ของแถม 5 ชิ้น",
// 				ProductID:          products[1].ID,
// 			})
// 		}
// 	}

// 	// Bill ที่สาม: 2 items + 1 freebie
// 	if billIndex == 2 {
// 		if len(products) > 2 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       1,
// 				CompanyProductCode: products[2].Product_Code,
// 				CompanyProductName: products[2].Product_Name,
// 				OrderQuantity:      300,
// 				Unit:               "ลิตร",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       110.00,
// 				DiscountAmount:     3000.00,
// 				NetAmount:          30000.00,
// 				IsFreebie:          false,
// 				Remark:             "ซื้อเยอะได้ส่วนลด",
// 				ProductID:          products[2].ID,
// 			})
// 		}
// 		if len(products) > 0 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       2,
// 				CompanyProductCode: products[0].Product_Code,
// 				CompanyProductName: products[0].Product_Name,
// 				OrderQuantity:      40,
// 				Unit:               "ชิ้น",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       870.00,
// 				DiscountAmount:     0.00,
// 				NetAmount:          34800.00,
// 				IsFreebie:          false,
// 				Remark:             "",
// 				ProductID:          products[0].ID,
// 			})
// 		}
// 		if len(products) > 1 {
// 			items = append(items, entity.BillItem{
// 				BillID:             billID,
// 				ItemSequence:       3,
// 				CompanyProductCode: products[1].Product_Code,
// 				CompanyProductName: products[1].Product_Name,
// 				OrderQuantity:      10,
// 				Unit:               "ชิ้น",
// 				ConversionFactor:   1.0,
// 				PricePerUnit:       0.00,
// 				DiscountAmount:     0.00,
// 				NetAmount:          0.00,
// 				IsFreebie:          true,
// 				Remark:             "ของแถมจากโปรโมชั่น",
// 				ProductID:          products[1].ID,
// 			})
// 		}
// 	}

// 	return items
// }