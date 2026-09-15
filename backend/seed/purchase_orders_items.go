package seed

import (
	"backend/internal/app/entity"
	"errors"
	"fmt"

	"gorm.io/gorm"
)

func PurchaseOrdersItems(db *gorm.DB) error {
	rows := []struct {
		PONumber    string
		ProductCode string
		Quantity    float64
	}{
		{PONumber: "PO-2026-0001", ProductCode: "BR-900X", Quantity: 20},
		{PONumber: "PO-2026-0002", ProductCode: "GSK-882", Quantity: 20},
		{PONumber: "PO-2026-0003", ProductCode: "OIL-SYN-5W40-X", Quantity: 20},
	}

	for _, row := range rows {
		var po entity.PO
		if err := db.Where("po_number = ?", row.PONumber).First(&po).Error; err != nil {
			return fmt.Errorf("failed to find PO %s: %w", row.PONumber, err)
		}

		var product entity.Product
		if err := db.Preload("Unit").Where("product_code = ?", row.ProductCode).First(&product).Error; err != nil {
			return fmt.Errorf("failed to find product %s: %w", row.ProductCode, err)
		}

		var inventory entity.Inventory
		if err := db.Where(
			"product_id = ? AND supplier_id = ?",
			product.ID,
			po.SupplierID,
		).First(&inventory).Error; err != nil {
			return fmt.Errorf("failed to find inventory for PO %s: %w", row.PONumber, err)
		}

		unitName := ""
		if product.Unit != nil {
			unitName = product.Unit.Unit_Name
		}

		// ใช้ยอดรวมของ PO เป็นฐาน เพื่อให้ยอดรายการ Seed ตรงกับหัว PO เสมอ
		unitPrice := po.Total_amount / row.Quantity
		productID := product.ID
		item := entity.POItems{
			POID:                         po.ID,
			ProductID:                    &productID,
			Product_name_snapshot:        product.Product_Name,
			Product_code_snapshot:        product.Product_Code,
			Supply_product_code_snapshot: inventory.CompanyProductCode,
			Quantity:                     row.Quantity,
			Unit:                         unitName,
			UnitPrice:                    unitPrice,
			SubTotal:                     po.Total_amount,
		}

		var existing entity.POItems
		err := db.Where("po_id = ?", po.ID).First(&existing).Error
		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			if err := db.Create(&item).Error; err != nil {
				return fmt.Errorf("failed to create item for PO %s: %w", row.PONumber, err)
			}
		case err != nil:
			return fmt.Errorf("failed to query item for PO %s: %w", row.PONumber, err)
		default:
			if err := db.Model(&existing).Updates(map[string]interface{}{
				"product_id":                   item.ProductID,
				"product_name_snapshot":        item.Product_name_snapshot,
				"product_code_snapshot":        item.Product_code_snapshot,
				"supply_product_code_snapshot": item.Supply_product_code_snapshot,
				"quantity":                     item.Quantity,
				"unit":                         item.Unit,
				"unit_price":                   item.UnitPrice,
				"sub_total":                    item.SubTotal,
			}).Error; err != nil {
				return fmt.Errorf("failed to update item for PO %s: %w", row.PONumber, err)
			}
		}

		fmt.Printf("Seeded item for %s from inventory %d\n", row.PONumber, inventory.ID)
	}

	return nil
}
