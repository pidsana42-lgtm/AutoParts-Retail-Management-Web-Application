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
			CreditTerm:         "30 Days",
			PaymentStatus:      "PENDING",
			IsVerified:         true,
			OCRText:            "THANK YOU FOR YOUR BUSINESS... TOTAL: 10,165 THB",
			EvidenceFileURL:    "https://storage.googleapis.com/bucket/evidences/pay_slip_001.pdf",
			EvidenceUploadedAt: time.Now(),

			// --- Mapping Foreign Keys ---
			SupplierID:  1, // สมมติ ID ของ Supplier เป็น 99
			BillImageID: 1, // ตรงกับ BillImage IDด้านบน
			VerifiedBy:  1, // ตรงกับ User ID ด้านบน
			POID:        1, // ตรงกับ PO ID ด้านบน
		},
	}

	for _, b := range bills {
		if err := db.FirstOrCreate(&b, &entity.Bill{BillNo: b.BillNo}).Error; err != nil {
			log.Fatalf("failed to seed bill %s: %v", b.BillNo, err)
		}
	}

	return nil
}
