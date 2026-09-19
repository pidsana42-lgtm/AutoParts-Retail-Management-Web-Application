package seed

import (
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"fmt"
	"time"

	"gorm.io/gorm"
)

func PurchaseOrders(db *gorm.DB) error {
	// Query users dynamically to avoid hardcoded ID mismatches
	var owner entity.User
	var employee entity.User
	var manager entity.User

	if err := db.Where("username = ?", "boss").First(&owner).Error; err != nil {
		return fmt.Errorf("failed to fetch owner user for PO seeding: %w", err)
	}
	if err := db.Where("username = ?", "employee").First(&employee).Error; err != nil {
		return fmt.Errorf("failed to fetch employee user for PO seeding: %w", err)
	}
	if err := db.Where("username = ?", "manager").First(&manager).Error; err != nil {
		if errAdmin := db.Where("username = ?", "admin").First(&manager).Error; errAdmin != nil {
			return fmt.Errorf("failed to fetch manager user for PO seeding: %w", err)
		}
	}

	noteText := "ส่งสินค้าภายในเวลาทำการ 09:00 - 16:00 น. เท่านั้น"
	approvedBy := owner.ID
	approvedAt := time.Now().Add(-1 * time.Hour)

	purchaseOrders := []entity.PO{
		{
			PO_number:   "PO-2026-0001",
			Status:      enum.StatusApproved,
			Total_amount: 59000.00,
			Notes:       &noteText,
			Created_by:  owner.ID,
			LastUpdatedBy: &owner.ID,
			Approved_by: &approvedBy,
			Approved_at: &approvedAt,
			SupplierID:  1,
			PO_type_id:  1,
		},
		{
			PO_number:   "PO-2026-0002",
			Status:      enum.StatusApproved,
			Total_amount: 30000.00,
			Notes:       &noteText,
			Created_by:  owner.ID,
			LastUpdatedBy: &owner.ID,
			Approved_by: &approvedBy,
			Approved_at: &approvedAt,
			SupplierID:  2,
			PO_type_id:  1,
		},
		{
			PO_number:   "PO-2026-0003",
			Status:      enum.StatusApproved,
			Total_amount: 100000.00,
			Notes:       &noteText,
			Created_by:  manager.ID,
			LastUpdatedBy: &owner.ID,
			Approved_by: &approvedBy,
			Approved_at: &approvedAt,
			SupplierID:  3,
			PO_type_id:  1,
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
