package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type POSProductRepository interface {
	SearchProducts(search string) ([]entity.Product, error)
	GetProductByID(id uint) (*entity.Product, error)
	UpdateProductWithTx(tx *gorm.DB, product *entity.Product) error
}

type posProductRepository struct {
	db *gorm.DB
}

func NewPOSProductRepository(db *gorm.DB) POSProductRepository {
	return &posProductRepository{db: db}
}

func (r *posProductRepository) SearchProducts(search string) ([]entity.Product, error) {
	var products []entity.Product

	query := r.db.Preload("Grade").Preload("Models").Preload("Models.Brand").Where("is_active = ?", true)
	if search != "" {
		likeSearch := "%" + search + "%"
		query = query.Where("product_code LIKE ? OR barcode = ? OR product_name ILIKE ? OR part_number LIKE ?", likeSearch, search, likeSearch, likeSearch)
	}

	err := query.Find(&products).Error
	return products, err
}

func (r *posProductRepository) GetProductByID(id uint) (*entity.Product, error) {
	var product entity.Product

	if err := r.db.Preload("Unit").First(&product, id).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *posProductRepository) UpdateProductWithTx(tx *gorm.DB, product *entity.Product) error {
	return tx.Save(product).Error
}
