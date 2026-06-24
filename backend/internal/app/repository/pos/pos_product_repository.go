package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type POSProductRepository interface {
	SearchProducts(search string) ([]entity.Product, error)
}

type posProductRepository struct {
	db *gorm.DB
}

func NewPOSProductRepository(db *gorm.DB) POSProductRepository {
	return &posProductRepository{db: db}
}

func (r *posProductRepository) SearchProducts(search string) ([]entity.Product, error) {
	var products []entity.Product
	
	query := r.db.Where("is_active = ?", true)

	if search != "" {
		likeSearch := "%" + search + "%"
		query = query.Where("product_code LIKE ? OR barcode = ? OR product_name ILIKE ?", likeSearch, search, likeSearch)
	}

	err := query.Find(&products).Error
	return products, err
}