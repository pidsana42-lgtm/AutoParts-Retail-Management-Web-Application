package seed

import (
	"backend/internal/app/entity"
	//"fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

func Bill(db *gorm.DB) error {

	bills := []entity.Bill{
		{
			BillNo:             "INV-2026-8899",
			TotalAmount:        10000.00,                    // ยอดดิบก่อนหักส่วนลด
			DiscountTotal:      500.00,                      // ส่วนลด 500 บาท
			Subtotal:           9500.00,                     // TotalAmount - DiscountTotal
			VatAmount:          665.00,                      // VAT 7% ของ Subtotal (9500 * 0.07)
			GrandTotal:         10165.00,                    // ยอดสุทธิที่ต้องจ่าย (Subtotal + VatAmount)
			DueDate:            time.Now().AddDate(0, 1, 0), // ครบกำหนดอีก 30 วันข้างหน้า
			TransportBy:        "Kerry Express",
			ReceiveDate:        time.Now(),
			PaymentStatus:      "PENDING",
			IsVerified:         true,
			OCRText:            "THANK YOU FOR YOUR BUSINESS... TOTAL: 10,165 THB",
			EvidenceFileURL:    "https://storage.googleapis.com/bucket/evidences/pay_slip_001.pdf",
			EvidenceUploadedAt: time.Now(),

			// --- Mapping Foreign Keys ---
			SupplierID:  1, // สมมติ ID ของ Supplier เป็น 99
			BillImageID: func() *uint { id := uint(1); return &id }(),
			VerifiedBy:  1, // ตรงกับ User ID ด้านบน
			POID:        func() *uint { id := uint(2); return &id }(),
		},
	}

	for _, b := range bills {
		var existing entity.Bill
		err := db.Unscoped().Where("bill_no = ?", b.BillNo).First(&existing).Error
		if err == gorm.ErrRecordNotFound {
			// Find actual database IDs dynamically to ensure foreign key constraints are met
			var supplier entity.Supplier
			var billImage entity.BillImage
			var ownerUser entity.User
			var po entity.PO

			if err := db.Where("image_url = ?", "https://storage.googleapis.com/bucket/bill_images/bill_image_001.jpg").First(&billImage).Error; err == nil {
				b.BillImageID = &billImage.ID
			} else if err := db.First(&billImage).Error; err == nil {
				b.BillImageID = &billImage.ID
			} else {
				b.BillImageID = nil
			}

			if err := db.First(&supplier).Error; err == nil {
				b.SupplierID = supplier.ID
			}

			if err := db.Where("username = ?", "boss").First(&ownerUser).Error; err == nil {
				b.VerifiedBy = ownerUser.ID
			} else if err := db.First(&ownerUser).Error; err == nil {
				b.VerifiedBy = ownerUser.ID
			}

			if err := db.Where("po_number = ?", "PO-2026-0002").First(&po).Error; err == nil {
				b.POID = &po.ID
			} else if err := db.First(&po).Error; err == nil {
				b.POID = &po.ID
			} else {
				b.POID = nil
			}

			if err := db.Create(&b).Error; err != nil {
				log.Printf("failed to seed bill %s: %v", b.BillNo, err)
			} else {
				log.Printf("Created bill: %s\n", b.BillNo)
			}
		} else if err != nil {
			log.Printf("failed to query bill %s: %v", b.BillNo, err)
		} else {
			log.Printf("Skipped bill (exists): %s\n", b.BillNo)
		}
	}

	return nil
}
