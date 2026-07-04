package seed

import (
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"fmt"
	"time"

	"gorm.io/gorm"
)

func PurchaseOrders(db *gorm.DB) error {
	// ค่าที่ใช้ร่วม (ต้องประกาศในฟังก์ชัน)
	noteText := "ส่งสินค้าภายในเวลาทำการ 09:00 - 16:00 น. เท่านั้น"
	approvedBy := uint(2)                          // User ID: 2 (employee) เป็นผู้อนุมัติ
	approvedAt := time.Now().Add(-1 * time.Hour)   // อนุมัติเมื่อ 1 ชั่วโมงที่แล้ว
	expiresAt := time.Now().AddDate(0, 3, 0)       // หมดอายุในอีก 3 เดือน
	pdfGeneratedAt := time.Now().Add(-2 * time.Hour)

	purchaseOrders := []entity.PO{
		{
			// ผูกกับ BILL-2024-001 (Subtotal 59,000)
			PO_number:        "PO-2026-0001",
			Status:           enum.StatusApproved,
			Total_amount:     59000.00,
			Expires_at:       &expiresAt,
			Pdf_url:          "https://storage.googleapis.com/bucket/pos/po-2026-0001.pdf",
			Pdf_generated_at: &pdfGeneratedAt,
			Notes:            &noteText,
			Created_by:       1, // owner
			Approved_by:      &approvedBy,
			Approved_at:      &approvedAt,
			SupplierID:       1, // บริษัท ไทยออโต้พาร์ท จำกัด (TAP)
			PO_type_id:       1, // Procurement
		},
		{
			// ผูกกับ BILL-2024-002 (Subtotal 30,000)
			PO_number:        "PO-2026-0002",
			Status:           enum.StatusApproved,
			Total_amount:     30000.00,
			Expires_at:       &expiresAt,
			Pdf_url:          "https://storage.googleapis.com/bucket/pos/po-2026-0002.pdf",
			Pdf_generated_at: &pdfGeneratedAt,
			Notes:            &noteText,
			Created_by:       1, // owner
			Approved_by:      &approvedBy,
			Approved_at:      &approvedAt,
			SupplierID:       2, // หจก. โคราชมอเตอร์พาร์ท (KMP)
			PO_type_id:       1, // Procurement
		},
		{
			// ผูกกับ BILL-2024-003 (Subtotal 100,000)
			PO_number:        "PO-2026-0003",
			Status:           enum.StatusApproved,
			Total_amount:     100000.00,
			Expires_at:       &expiresAt,
			Pdf_url:          "https://storage.googleapis.com/bucket/pos/po-2026-0003.pdf",
			Pdf_generated_at: &pdfGeneratedAt,
			Notes:            &noteText,
			Created_by:       3, // manager
			Approved_by:      &approvedBy,
			Approved_at:      &approvedAt,
			SupplierID:       3, // บริษัท ปตท. หล่อลื่น จำกัด (PTT-LUB)
			PO_type_id:       1, // Procurement
		},
	}

	for _, po := range purchaseOrders {
		var existing entity.PO

		// Unscoped = ค้นหารวม row ที่ถูก soft-delete ด้วย → กันชน unique index
		err := db.Unscoped().Where("po_number = ?", po.PO_number).First(&existing).Error

		switch err {
		case gorm.ErrRecordNotFound:
			// ยังไม่มี po_number นี้ → สร้างใหม่
			if err := db.Create(&po).Error; err != nil {
				return fmt.Errorf("failed to create purchase order %s: %w", po.PO_number, err)
			}
			fmt.Printf("Created PO: %s\n", po.PO_number)

		case nil:
			// มี po_number นี้แล้ว (ข้อมูลเดิม) → ข้าม
			fmt.Printf("Skipped PO (exists): %s\n", po.PO_number)

		default:
			return fmt.Errorf("failed to query purchase order %s: %w", po.PO_number, err)
		}
	}
	return nil
}
