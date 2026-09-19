package seed

import (
	"backend/internal/app/entity"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

// Inventory creates the product/supplier pairs used by the seeded purchase
// orders. Supplier IDs are read from the POs instead of being hardcoded so the
// seed remains correct even when database IDs differ between environments.
func Inventory(db *gorm.DB) error {
	rows := []struct {
		PONumber           string
		ProductCode        string
		CompanyProductCode string
		VariantCode        string
		Barcode            string
		QRCode             string
		Quantity           int
	}{
		{
			PONumber:           "PO-2026-0001",
			ProductCode:        "BR-900X",
			CompanyProductCode: "TAP-TURBO-900X",
			VariantCode:        "BR-900X-TAP",
			Barcode:            "8850000000001",
			QRCode:             "INV-BR-900X-TAP",
			Quantity:           50,
		},
		{
			PONumber:           "PO-2026-0002",
			ProductCode:        "GSK-882",
			CompanyProductCode: "KMP-GASKET-882",
			VariantCode:        "GSK-882-KMP",
			Barcode:            "8850000000002",
			QRCode:             "INV-GSK-882-KMP",
			Quantity:           40,
		},
		{
			PONumber:           "PO-2026-0003",
			ProductCode:        "OIL-SYN-5W40-X",
			CompanyProductCode: "PTT-OIL-5W40-5L",
			VariantCode:        "OIL-5W40-PTT",
			Barcode:            "8850000000003",
			QRCode:             "INV-OIL-5W40-PTT",
			Quantity:           30,
		},
	}

	for _, row := range rows {
		var po entity.PO
		if err := db.Where("po_number = ?", row.PONumber).First(&po).Error; err != nil {
			return fmt.Errorf("failed to find PO %s for inventory seed: %w", row.PONumber, err)
		}

		var product entity.Product
		if err := db.Where("product_code = ?", row.ProductCode).First(&product).Error; err != nil {
			return fmt.Errorf("failed to find product %s for inventory seed: %w", row.ProductCode, err)
		}

		values := map[string]interface{}{
			"inventory_quantity":     row.Quantity,
			"last_updated_date_time": time.Now(),
			"variant_code":           row.VariantCode,
			"company_product_code":   row.CompanyProductCode,
			"barcode":                row.Barcode,
			"qr_code":                row.QRCode,
			"deleted_at":             nil,
		}

		var inventory entity.Inventory
		err := db.Unscoped().Where(
			"product_id = ? AND supplier_id = ?",
			product.ID,
			po.SupplierID,
		).First(&inventory).Error

		switch {
		case errors.Is(err, gorm.ErrRecordNotFound):
			inventory = entity.Inventory{
				Inventory_Quantity:    row.Quantity,
				Last_Updated_DateTime: time.Now(),
				Variant_Code:          row.VariantCode,
				ProductID:             product.ID,
				SupplierID:            po.SupplierID,
				CompanyProductCode:    row.CompanyProductCode,
				Barcode:               row.Barcode,
				QRCode:                row.QRCode,
			}
			if err := db.Create(&inventory).Error; err != nil {
				return fmt.Errorf("failed to create inventory for %s: %w", row.PONumber, err)
			}
		case err != nil:
			return fmt.Errorf("failed to query inventory for %s: %w", row.PONumber, err)
		default:
			if err := db.Unscoped().Model(&inventory).Updates(values).Error; err != nil {
				return fmt.Errorf("failed to update inventory for %s: %w", row.PONumber, err)
			}
		}
	}

	return nil
}
