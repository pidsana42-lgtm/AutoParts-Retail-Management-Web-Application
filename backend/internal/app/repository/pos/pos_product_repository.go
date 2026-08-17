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

    query := r.db.Preload("Grade").Preload("Models").Preload("Models.Brand").Where("is_active = ?", true)
    
    if search != "" {
        // แปลงคำค้นหาเป็นตัวพิมพ์เล็ก และตัดช่องว่างส่วนเกิน
        cleanSearch := strings.ToLower(strings.TrimSpace(search))
        likeSearch := "%" + cleanSearch + "%"

        // 	เปลี่ยน barcode = ? ให้ใช้ LIKE และใช้ LOWER() ป้องกันปัญหา Case-Sensitive ครบทุกฟิลด์
        query = query.Where(
            "LOWER(product_code) LIKE ? OR LOWER(barcode) LIKE ? OR LOWER(product_name) LIKE ? OR LOWER(part_number) LIKE ?", 
            likeSearch, likeSearch, likeSearch, likeSearch,
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
