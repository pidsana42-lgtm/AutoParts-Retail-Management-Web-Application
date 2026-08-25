package wms

import (
	"backend/internal/app/entity"
	"log"

	"gorm.io/gorm"
)

type ProductRepository interface {
	CreateProduct(product *entity.Product) error
	GetProductByID(id uint) (*entity.Product, error)
	UpdateProduct(product *entity.Product) error
	DeleteProduct(id uint) error
	CreateProductImage(image *entity.ProductImage) error
	ListProducts() ([]entity.Product, error)
	ListBrands() ([]entity.Brand, error)
	CreateBrand(brand *entity.Brand) error
	UpdateBrand(brand *entity.Brand) error
	DeleteBrand(id uint) error

	CreateModel(model *entity.Models) error
	UpdateModel(model *entity.Models) error
	DeleteModel(id uint) error

	// ReplaceProductSuppliers: ตั้งรายชื่อ Supplier ของสินค้านี้ให้ตรงกับชุดที่ส่งมา (จากฟอร์มเพิ่ม/แก้ไขสินค้า ที่ส่งมาเป็น
	// "รายชื่อทั้งหมด ณ ตอนนี้" ทุกครั้ง) — เทียบกับของเดิมแล้วอัปเดต/สร้าง/ลบเฉพาะแถวที่เปลี่ยนจริง ไม่ลบทิ้งทั้งหมดแล้วสร้างใหม่
	ReplaceProductSuppliers(productID uint, inventories []entity.Inventory) error

	// ReceiveStock: รับสินค้าเข้าเพิ่มให้สินค้าที่มีอยู่แล้ว — บวกจำนวนรวมเข้ากับยอดคงเหลือเดิม
	// และบวกจำนวนต่อ Supplier เข้ากับของเดิม (ไม่ใช่แทนที่แบบ ReplaceProductSuppliers)
	ReceiveStock(productID uint, addedQty int, suppliers []entity.Inventory) error
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) CreateProduct(product *entity.Product) error {
	return r.db.Omit("Category", "SubCategory", "SubSubCategory", "Grade", "Unit", "Shelf", "ShelfLevel").Create(product).Error
}

func (r *productRepository) GetProductByID(id uint) (*entity.Product, error) {
	var product entity.Product
	err := r.db.Preload("Models").Preload("Models.Brand").Preload("Category").Preload("SubCategory").Preload("SubSubCategory").Preload("Grade").Preload("Unit").Preload("Shelf").Preload("Shelf.Zone").Preload("ShelfLevel").
		Preload("ProductImages", func(db *gorm.DB) *gorm.DB {
			return db.Order("product_images.created_at DESC")
		}).
		Preload("Inventories.Supplier").
		First(&product, id).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *productRepository) UpdateProduct(product *entity.Product) error {
	if product.SubCategoryID != nil {
		log.Printf("[DEBUG] Repo UpdateProduct: SubCategoryID is: %d", *product.SubCategoryID)
	} else {
		log.Printf("[DEBUG] Repo UpdateProduct: SubCategoryID is nil!")
	}
	// Omit relationships so GORM does not set foreign keys to NULL if the association struct is nil
	err := r.db.Omit("Category", "SubCategory", "SubSubCategory", "Grade", "Unit", "Shelf", "ShelfLevel", "Models", "ProductImages").Save(product).Error
	if err != nil {
		return err
	}
	return r.db.Model(product).Association("Models").Replace(product.Models)
}

func (r *productRepository) DeleteProduct(id uint) error {
	return r.db.Delete(&entity.Product{}, id).Error
}

func (r *productRepository) CreateProductImage(image *entity.ProductImage) error {
	return r.db.Create(image).Error
}

func (r *productRepository) ListProducts() ([]entity.Product, error) {
	var products []entity.Product
	err := r.db.Preload("Models").Preload("Models.Brand").Preload("Category").Preload("SubCategory").Preload("SubSubCategory").Preload("Grade").Preload("Unit").Preload("Shelf").Preload("Shelf.Zone").Preload("ShelfLevel").
		Preload("ProductImages", func(db *gorm.DB) *gorm.DB {
			return db.Order("product_images.created_at DESC")
		}).
		Preload("Inventories.Supplier").
		Find(&products).Error
	return products, err
}

func (r *productRepository) ListBrands() ([]entity.Brand, error) {
	var brands []entity.Brand
	err := r.db.Preload("Models").Order("brand_name asc").Find(&brands).Error
	return brands, err
}

func (r *productRepository) CreateBrand(brand *entity.Brand) error {
	return r.db.Create(brand).Error
}

func (r *productRepository) UpdateBrand(brand *entity.Brand) error {
	return r.db.Save(brand).Error
}

func (r *productRepository) DeleteBrand(id uint) error {
	return r.db.Delete(&entity.Brand{}, id).Error
}

func (r *productRepository) CreateModel(model *entity.Models) error {
	return r.db.Create(model).Error
}

func (r *productRepository) UpdateModel(model *entity.Models) error {
	return r.db.Save(model).Error
}

func (r *productRepository) DeleteModel(id uint) error {
	return r.db.Delete(&entity.Models{}, id).Error
}

// ReplaceProductSuppliers: เทียบรายชื่อ Supplier ใหม่กับของเดิมในตาราง (แทนที่จะลบทิ้งทั้งหมดแล้วสร้างใหม่)
//   - Supplier เดิมที่ยังอยู่ในรายชื่อใหม่ -> UPDATE แค่จำนวน (แถวเดิม id เดิม ไม่สร้างขยะ)
//   - Supplier ที่เพิ่งเพิ่มเข้ามา -> CREATE แถวใหม่
//   - Supplier ที่ถูกเอาออกจากรายชื่อ -> DELETE เฉพาะแถวนั้น (soft delete ตามปกติ)
//
// เดิมใช้วิธีลบทั้งหมดของสินค้านี้แล้วสร้างใหม่ทั้งชุดทุกครั้งที่บันทึก ทำให้ทุกครั้งที่แก้ไขสินค้า
// ต่อให้ Supplier ไม่ได้เปลี่ยนอะไรเลย แถวเดิมก็โดน soft-delete แล้วสร้างแถวใหม่ id ใหม่แทนตลอด
// สะสมเป็นข้อมูลขยะ (deleted_at) เพิ่มขึ้นเรื่อยๆ ทุกครั้งที่แก้ไข
func (r *productRepository) ReplaceProductSuppliers(productID uint, inventories []entity.Inventory) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var existing []entity.Inventory
		if err := tx.Where("product_id = ?", productID).Find(&existing).Error; err != nil {
			return err
		}

		existingBySupplier := make(map[uint]entity.Inventory, len(existing))
		for _, inv := range existing {
			existingBySupplier[inv.SupplierID] = inv
		}

		keptSupplierIDs := make(map[uint]bool, len(inventories))
		for _, inv := range inventories {
			keptSupplierIDs[inv.SupplierID] = true

			if old, found := existingBySupplier[inv.SupplierID]; found {
				// Supplier เดิม ยังอยู่ในรายชื่อใหม่ -> อัปเดตแค่จำนวน ไม่แตะแถวเดิม
				if err := tx.Model(&entity.Inventory{}).Where("id = ?", old.ID).Updates(map[string]interface{}{
					"inventory_quantity":    inv.Inventory_Quantity,
					"last_updated_datetime": inv.Last_Updated_DateTime,
				}).Error; err != nil {
					return err
				}
				continue
			}

			// Supplier ใหม่ ไม่เคยมีมาก่อน -> สร้างแถวใหม่
			inv.ProductID = productID
			if err := tx.Create(&inv).Error; err != nil {
				return err
			}
		}

		// Supplier เดิมที่ไม่อยู่ในรายชื่อใหม่แล้ว -> เอาออกจริง
		for supplierID, old := range existingBySupplier {
			if !keptSupplierIDs[supplierID] {
				if err := tx.Delete(&entity.Inventory{}, old.ID).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

// ReceiveStock: ใช้ตอน "รับสินค้าเข้าเพิ่ม" ให้สินค้าที่มีอยู่แล้ว (ไม่ใช่ตอนแก้ไขข้อมูลสินค้าทั้งหมด)
// ต่างจาก ReplaceProductSuppliers ตรงที่นี่ "บวกเพิ่ม" เข้ากับยอดเดิมเสมอ ไม่ใช่ตั้งค่าใหม่ทับของเดิม
func (r *productRepository) ReceiveStock(productID uint, addedQty int, suppliers []entity.Inventory) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&entity.Product{}).Where("id = ?", productID).
			Update("quantity", gorm.Expr("quantity + ?", addedQty)).Error; err != nil {
			return err
		}

		for _, sup := range suppliers {
			var existing entity.Inventory
			err := tx.Where("product_id = ? AND supplier_id = ?", productID, sup.SupplierID).First(&existing).Error
			if err == nil {
				// Supplier นี้เคยรับมาแล้ว -> บวกจำนวนที่รับรอบนี้เพิ่มเข้าไปในยอดเดิม
				if err := tx.Model(&entity.Inventory{}).Where("id = ?", existing.ID).Updates(map[string]interface{}{
					"inventory_quantity":    gorm.Expr("inventory_quantity + ?", sup.Inventory_Quantity),
					"last_updated_datetime": sup.Last_Updated_DateTime,
				}).Error; err != nil {
					return err
				}
				continue
			}
			if err != gorm.ErrRecordNotFound {
				return err
			}

			// Supplier นี้ยังไม่เคยมีมาก่อน -> สร้างแถวใหม่ให้เลย
			sup.ProductID = productID
			if err := tx.Create(&sup).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
