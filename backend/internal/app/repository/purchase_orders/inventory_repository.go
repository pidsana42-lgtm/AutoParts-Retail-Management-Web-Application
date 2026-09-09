package purchaseorders

import (
	poDto "backend/internal/app/dto/purchase_orders"
	poEntity "backend/internal/app/entity"
	"context"
	"gorm.io/gorm"
)

// InventoryRepository คุมตาราง inventories (สต็อกสินค้า ผูกกับ Supplier แต่ละราย)
// สินค้า 1 ตัวอาจมีสต็อกแยกได้หลาย Supplier ผ่านตารางนี้
type InventoryRepository interface {
	// ดึงสต็อกของสินค้า 1 ตัว จาก Supplier ที่ระบุ
	GetInventoryByProductAndSupplier(ctx context.Context, productID uint, supplierID uint) (*poEntity.Inventory, error)
	// ดึงสต็อกทั้งหมดของสินค้า 1 ตัว (ทุก Supplier ที่มี)
	GetInventoryByProductID(ctx context.Context, productID uint) ([]poEntity.Inventory, error)
	// ดึงสต็อกทั้งหมดของ Supplier 1 ราย (ทุกสินค้า)
	GetInventoryBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Inventory, error)
	// ดึงรายชื่อสินค้าทั้งหมดที่ Supplier รายนี้เคยส่ง (join ผ่าน inventories)
	GetProductBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Product, error)
	// ค้นหาสินค้าของ Supplier ที่เลือก ด้วยชื่อ/รหัส (ใช้ในหน้าสร้าง PO)
	SearchProducts(ctx context.Context, supplierID string, keyword string) ([]poDto.ProductSearchResponse, error)
}

type inventoryRepository struct {
	db *gorm.DB
}

func NewInventoryRepository(db *gorm.DB) InventoryRepository {
	return &inventoryRepository{db: db}
}

func (r *inventoryRepository) GetInventoryByProductAndSupplier(ctx context.Context, productID uint, supplierID uint) (*poEntity.Inventory, error) {
	var inv poEntity.Inventory

	err := r.db.WithContext(ctx).
		Preload("Product").
		Preload("Supplier").
		Where("product_id = ? AND supplier_id = ?", productID, supplierID).
		First(&inv).Error
	if err != nil {
		return nil, err
	}

	return &inv, nil
}

func (r *inventoryRepository) GetInventoryByProductID(ctx context.Context, productID uint) ([]poEntity.Inventory, error) {
	var invs []poEntity.Inventory

	err := r.db.WithContext(ctx).
		Preload("Supplier").
		Where("product_id = ?", productID).
		Find(&invs).Error

	return invs, err
}

func (r *inventoryRepository) GetInventoryBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Inventory, error) {
	var invs []poEntity.Inventory

	err := r.db.WithContext(ctx).
		Preload("Product").
		Where("supplier_id = ?", supplierID).
		Find(&invs).Error

	return invs, err
}

func (r *inventoryRepository) GetProductBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Product, error) {
	var products []poEntity.Product

	// Distinct กันสินค้าซ้ำ เผื่อ 1 คู่ product+supplier มีได้หลาย inventory record (เช่นรับของหลายล็อต)
	err := r.db.WithContext(ctx).
		Distinct("products.*").
		Joins("JOIN inventories ON inventories.product_id = products.id").
		Where("inventories.supplier_id = ?", supplierID).
		Find(&products).Error

	return products, err
}

// SearchProducts ค้นหาสินค้าของ Supplier ที่เลือก โดย join ผ่านตาราง inventories
// เพราะ supplier_id และ stock_qty ผูกอยู่กับ inventory ไม่ใช่ product โดยตรง
// *** unit_id เป็นชื่อ FK ที่เดาไว้ตาม pattern ปกติ ถ้า error อีกให้เช็ค entity Product จริง ***
func (r *inventoryRepository) SearchProducts(ctx context.Context, supplierID string, keyword string) ([]poDto.ProductSearchResponse, error) {
	var products []poDto.ProductSearchResponse

	err := r.db.WithContext(ctx).
		Table("inventories").
		Select(`DISTINCT
			products.id AS id,
			products.product_code AS code,
			COALESCE(NULLIF(inventories.barcode, ''), products.product_code) AS barcode,
			products.product_name AS name,
			products.cost_price AS price,
			units.unit_name AS unit,
			inventories.inventory_quantity AS stock_qty`).
		Joins("JOIN products ON products.id = inventories.product_id").
		Joins("LEFT JOIN units ON units.id = products.unit_id").
		Where("inventories.supplier_id = ?", supplierID).
		Where(
			"products.product_name LIKE ? OR products.product_code LIKE ? OR inventories.barcode LIKE ? OR inventories.variant_code LIKE ? OR inventories.company_product_code LIKE ?",
			"%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%", "%"+keyword+"%",
		).
		Limit(20).
		Find(&products).Error

	if err != nil {
		return nil, err
	}

	return products, nil
}
