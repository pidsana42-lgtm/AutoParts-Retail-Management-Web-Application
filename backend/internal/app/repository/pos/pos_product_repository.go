package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
	"strings"
)

type POSProductRepository interface {
	SearchProducts(search string) ([]entity.Product, error)
	GetProductByID(id uint) (*entity.Product, error)
	// GetProductByIDWithTx: เหมือน GetProductByID แต่อ่านผ่าน tx ที่กำลังตัด/คืนสต็อกอยู่ ไม่ใช่ connection แยกนอก
	// transaction — จำเป็นตอนบิลเดียวกันมีสินค้าตัวเดียวกันซ้ำหลายแถว (เช่นซื้อจากคนละบริษัทแยกกันคนละแถว) เพื่อให้
	// แถวที่ 2 เห็นยอดที่แถวที่ 1 เพิ่งหักไปในทรานแซกชันเดียวกันด้วย ไม่งั้นจะเห็นยอดเก่าที่ยังไม่หัก เปิดช่องขายเกินสต็อกจริงได้
	GetProductByIDWithTx(tx *gorm.DB, id uint) (*entity.Product, error)
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

	query := r.db.Preload("Grade").Preload("Models").Preload("Models.Brand").Preload("Inventories").Preload("Inventories.Supplier").Where("is_active = ?", true)

	if search != "" {
		cleanSearch := strings.ToLower(strings.TrimSpace(search))
		likeSearch := "%" + cleanSearch + "%"

		// ค้นหาครอบคลุม product_code, product_name, part_number และ barcode/variant_code/company_product_code จากตาราง inventories
		// (ไม่มีคอลัมน์ barcode ที่ products อีกแล้ว — ย้ายไปผูกกับ Supplier แต่ละเจ้าที่ inventories แทน)
		query = query.Where(
			"LOWER(product_code) LIKE ? OR LOWER(product_name) LIKE ? OR LOWER(part_number) LIKE ? OR EXISTS (SELECT 1 FROM inventories WHERE inventories.product_id = products.id AND (LOWER(inventories.barcode) LIKE ? OR LOWER(inventories.variant_code) LIKE ? OR LOWER(inventories.company_product_code) LIKE ?))",
			likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch,
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

func (r *posProductRepository) GetProductByIDWithTx(tx *gorm.DB, id uint) (*entity.Product, error) {
	var product entity.Product

	if err := tx.Preload("Unit").First(&product, id).Error; err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *posProductRepository) UpdateProductWithTx(tx *gorm.DB, product *entity.Product) error {
	return tx.Save(product).Error
}
