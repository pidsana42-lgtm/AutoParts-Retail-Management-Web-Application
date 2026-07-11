package purchaseorders

import (
	"context"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
	poDto "backend/internal/app/dto/purchase_orders"
)

// ProductRepository คุมตาราง products (เอาไว้ให้ Service ไปหาข้อมูลมาทำ Snapshot)
type ProductRepository interface {
	GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error)
	GetProductBySupplierID(ctx context.Context, supplierID uint) ([]poEntity.Product, error)
	SearchProducts(supplierID string, keyword string) ([]poDto.ProductSearchResponse, error)
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

func (r *productRepository) SearchProducts(supplierID string, keyword string) ([]poDto.ProductSearchResponse, error) {
	var products []poDto.ProductSearchResponse
    err := r.db.Table("products").
        Select("id, code, name, price, unit, stock_qty").
        Where("supplier_id = ?", supplierID).
        Where("name LIKE ? OR code LIKE ?", "%" + keyword + "%", "%" + keyword + "%").
        Limit(20).
        Find(&products).Error

    if err != nil {
        return nil, err
    }

    return products, nil
}