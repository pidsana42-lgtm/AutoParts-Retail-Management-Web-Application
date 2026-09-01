package pos

import (
	"strings"
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

    query := r.db.Preload("Grade").Preload("Models").Preload("Models.Brand").Preload("Inventories").Where("is_active = ?", true)
    
    if search != "" {
        cleanSearch := strings.ToLower(strings.TrimSpace(search))
        likeSearch := "%" + cleanSearch + "%"

        // ค้นหาครอบคลุม product_code, barcode, product_name, part_number และ barcode/variant_code/company_product_code จากตาราง inventories
        query = query.Where(
            "LOWER(product_code) LIKE ? OR LOWER(barcode) LIKE ? OR LOWER(product_name) LIKE ? OR LOWER(part_number) LIKE ? OR EXISTS (SELECT 1 FROM inventories WHERE inventories.product_id = products.id AND (LOWER(inventories.barcode) LIKE ? OR LOWER(inventories.variant_code) LIKE ? OR LOWER(inventories.company_product_code) LIKE ?))", 
            likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch,
        )
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
