package purchaseorders

import (
	"context"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
)

// ProductRepository คุมตาราง products ล้วนๆ (ไม่ผูกกับ supplier/inventory)
// เอาไว้ให้ Service ไปหาข้อมูลมาทำ Snapshot ตอนสร้าง PO
type ProductRepository interface {
	GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error)
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error) {
	var product poEntity.Product

	// Preload Inventories.Supplier ด้วย: ใช้หารหัสสินค้าของ Supplier แต่ละเจ้า (CompanyProductCode ย้ายมาอยู่ที่ Inventory
	// แทน Product โดยตรงแล้ว เพราะสินค้า 1 ชิ้นมาจากหลาย Supplier ได้ แต่ละเจ้าใช้รหัสของตัวเองไม่เหมือนกัน)
	err := r.db.WithContext(ctx).Preload("Unit").Preload("Inventories.Supplier").First(&product, id).Error
	if err != nil {
		return nil, err
	}

	return &product, nil
}