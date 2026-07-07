package purchaseorders

import (
	"context"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
)

// ProductRepository คุมตาราง products (เอาไว้ให้ Service ไปหาข้อมูลมาทำ Snapshot)
type ProductRepository interface {
	GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error)
	GetProductBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Product, error)
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error) {
	var product poEntity.Product

	err := r.db.WithContext(ctx).Preload("Unit").First(&product, id).Error
	if err != nil {
		return nil, err
	}

	return &product, nil
}

func (r *productRepository) GetProductBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Product, error) {
	var products []poEntity.Product

	err := r.db.WithContext(ctx).Where("supplier_id = ?", supplierID).Find(&products).Error

	return products, err
}