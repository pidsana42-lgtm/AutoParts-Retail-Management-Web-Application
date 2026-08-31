package wms

import (
	"backend/internal/app/entity"
	"backend/internal/pkg/lotcode"

	"gorm.io/gorm"
)

// InventoryLotRepository: จัดการ "ล็อตสินค้าต่อบริษัท" (แถวในตาราง inventories)
// พร้อมรหัสล็อต (variant code) สำหรับพิมพ์ QR/บาร์โค้ดแยกบริษัท
type InventoryLotRepository interface {
	ListByProduct(productID uint) ([]entity.Inventory, error)
	ResolveCode(code string) (*entity.Inventory, error)
	BackfillMissingCodes(productID uint, allProducts bool) (int64, error)
}

type inventoryLotRepository struct {
	db *gorm.DB
}

func NewInventoryLotRepository(db *gorm.DB) InventoryLotRepository {
	return &inventoryLotRepository{db: db}
}

func (r *inventoryLotRepository) ListByProduct(productID uint) ([]entity.Inventory, error) {
	var lots []entity.Inventory
	err := r.db.Preload("Supplier").Preload("Product").
		Where("product_id = ?", productID).
		Order("created_at ASC").
		Find(&lots).Error
	return lots, err
}

func (r *inventoryLotRepository) ResolveCode(code string) (*entity.Inventory, error) {
	var lot entity.Inventory
	err := r.db.Preload("Supplier").Preload("Product").
		Where("variant_code = ?", code).
		First(&lot).Error
	if err != nil {
		return nil, err
	}
	return &lot, nil
}

// BackfillMissingCodes ออกรหัสล็อตให้ล็อตที่ยังไม่มีโค้ด (เช่น ข้อมูลเก่าก่อนเปิดฟีเจอร์นี้)
// productID > 0 = เฉพาะสินค้านั้น, allProducts = ทุกสินค้าในระบบ; คืนจำนวนแถวที่ออกโค้ดให้
func (r *inventoryLotRepository) BackfillMissingCodes(productID uint, allProducts bool) (int64, error) {
	query := r.db.Model(&entity.Inventory{}).Where("variant_code IS NULL OR variant_code = ''")
	if !allProducts {
		query = query.Where("product_id = ?", productID)
	}

	var lots []entity.Inventory
	if err := query.Find(&lots).Error; err != nil {
		return 0, err
	}

	var count int64
	for i := range lots {
		lot := lots[i]

		var supp entity.Supplier
		shortName := ""
		if lot.SupplierID > 0 {
			if err := r.db.First(&supp, lot.SupplierID).Error; err == nil {
				shortName = supp.ShortSupplierName
			}
		}

		var prod entity.Product
		prodCode := ""
		if lot.ProductID > 0 {
			if err := r.db.Select("product_code").First(&prod, lot.ProductID).Error; err == nil {
				prodCode = prod.Product_Code
			}
		}

		code := lotcode.Build(prodCode, shortName, lot.ID)
		if err := r.db.Model(&entity.Inventory{}).Where("id = ?", lot.ID).
			Update("variant_code", code).Error; err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}
