package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func PurchaseOrdersType(db *gorm.DB) error {
	purchaseOrdersType := []entity.POType{
		{PO_type_name: "Procurement"},
	}

	for _, pot := range purchaseOrdersType {
		var result entity.POType
		err := db.Where("po_type_name = ?", pot.PO_type_name).
			FirstOrCreate(&result, pot).Error
		if err != nil {
			return fmt.Errorf("failed to seed purchase order type %s: %w", pot.PO_type_name, err)
		}
	}
	return nil
}