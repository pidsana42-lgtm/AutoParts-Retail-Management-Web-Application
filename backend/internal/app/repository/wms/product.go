package wms

import (
	"backend/internal/app/entity"
	"backend/internal/pkg/lotcode"
	"log"
	"time"

	"gorm.io/gorm"
)

// assignVariantCode ออกรหัสประจำบริษัท (variant code) ให้แถว inventory ที่เพิ่งสร้าง
// เช่น TRAGSP-00002-TAP — ใช้พิมพ์ QR/บาร์โค้ดแยกบริษัทเพื่อให้ตัดสต็อกถูกเจ้า
func assignVariantCode(tx *gorm.DB, inv *entity.Inventory) error {
	var supp entity.Supplier
	shortName := ""
	if err := tx.First(&supp, inv.SupplierID).Error; err == nil {
		shortName = supp.ShortSupplierName
	}
	var prod entity.Product
	prodCode := ""
	if err := tx.Select("product_code").First(&prod, inv.ProductID).Error; err == nil {
		prodCode = prod.Product_Code
	}
	code := lotcode.Build(prodCode, shortName)
	updates := map[string]interface{}{
		"variant_code": code,
	}
	if inv.Barcode == "" {
		updates["barcode"] = code
	}
	if inv.QRCode == "" {
		updates["qr_code"] = code
	}
	return tx.Model(&entity.Inventory{}).Where("id = ?", inv.ID).Updates(updates).Error
}

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

	// ListDeletedProducts / RestoreProduct: สำหรับหน้า "ถังขยะ" — DeleteProduct เป็น soft delete
	// (แค่ตั้ง deleted_at ไม่ได้ลบแถวจริง) เลยกู้คืนกลับมาได้โดยไม่เสียข้อมูลอะไรเลย
	ListDeletedProducts() ([]entity.Product, error)
	RestoreProduct(id uint) error

	// GetPendingReceiveQuantity: รวมจำนวนของสินค้านี้ที่ถูกกันไว้ตามบิลนำเข้าต่างๆ ที่ยังรอเจ้าของอนุมัติราคาอยู่
	// (ยังไม่นับเข้า Quantity จริง) ไว้โชว์เป็นแบดจ์ "รอรับเข้า X ชิ้น" ในหน้ารายละเอียดสินค้า
	GetPendingReceiveQuantity(productID uint) (int, error)
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
	// Unscoped() ตั้งใจใส่ไว้: ดูรายละเอียดสินค้าด้วย ID ที่รู้อยู่แล้วควรหาเจอแม้สินค้าจะถูกลบไปแล้วก็ตาม
	// (เช่น กดดูรายละเอียดจากหน้าถังขยะ) — ต่างจาก ListProducts ที่ต้องกรองสินค้าที่ลบแล้วออกเป็นปกติ
	err := r.db.Unscoped().Preload("Models").Preload("Models.Brand").Preload("Category").Preload("SubCategory").Preload("SubSubCategory").Preload("Grade").Preload("Unit").Preload("Shelf").Preload("Shelf.Zone").Preload("ShelfLevel").
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

func (r *productRepository) GetPendingReceiveQuantity(productID uint) (int, error) {
	var total int
	err := r.db.Model(&entity.BillItem{}).
		Where("product_id = ? AND pending_receive_quantity > 0", productID).
		Select("COALESCE(SUM(pending_receive_quantity), 0)").
		Scan(&total).Error
	return total, err
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

// ListDeletedProducts: ดึงเฉพาะสินค้าที่ถูกลบ (soft delete) ไว้ — ต้องใช้ Unscoped() เพราะ GORM
// กรอง record ที่ deleted_at ไม่ว่างออกจาก query ปกติให้อัตโนมัติอยู่แล้ว
func (r *productRepository) ListDeletedProducts() ([]entity.Product, error) {
	var products []entity.Product
	err := r.db.Unscoped().Where("deleted_at IS NOT NULL").
		Preload("Models").Preload("Models.Brand").Preload("Category").Preload("SubCategory").Preload("SubSubCategory").Preload("Grade").Preload("Unit").Preload("Shelf").Preload("Shelf.Zone").Preload("ShelfLevel").
		Preload("ProductImages", func(db *gorm.DB) *gorm.DB {
			return db.Order("product_images.created_at DESC")
		}).
		Preload("Inventories.Supplier").
		Order("deleted_at DESC").
		Find(&products).Error
	return products, err
}

// RestoreProduct: กู้คืนสินค้าที่เคยลบไว้ กลับมาใช้งานได้ปกติ (ล้างค่า deleted_at ทิ้ง)
func (r *productRepository) RestoreProduct(id uint) error {
	return r.db.Unscoped().Model(&entity.Product{}).Where("id = ?", id).Update("deleted_at", nil).Error
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
				// Supplier เดิม ยังอยู่ในรายชื่อใหม่ -> อัปเดตแค่จำนวน+รหัสสินค้าของเจ้านี้ ไม่แตะแถวเดิม
				if err := tx.Model(&entity.Inventory{}).Where("id = ?", old.ID).Updates(map[string]interface{}{
					"inventory_quantity":     inv.Inventory_Quantity,
					"last_updated_date_time": inv.Last_Updated_DateTime,
					"company_product_code":   inv.CompanyProductCode,
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
			if err := assignVariantCode(tx, &inv); err != nil {
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
// บันทึกลง stock_movements (movement_type = "IN") ด้วยทุกครั้ง ในทรานแซกชันเดียวกัน เพื่อให้หน้า "การเคลื่อนไหวของสินค้า" มีประวัติ
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
				updates := map[string]interface{}{
					"inventory_quantity":     gorm.Expr("inventory_quantity + ?", sup.Inventory_Quantity),
					"last_updated_date_time": sup.Last_Updated_DateTime,
				}
				// อัปเดตรหัสสินค้าของ Supplier นี้เฉพาะตอนกรอกมาใหม่ (ไม่กรอกก็เก็บของเดิมไว้ ไม่เขียนทับเป็นค่าว่าง)
				if sup.CompanyProductCode != "" {
					updates["company_product_code"] = sup.CompanyProductCode
				}
				if err := tx.Model(&entity.Inventory{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
					return err
				}
			} else if err == gorm.ErrRecordNotFound {
				// Supplier นี้ยังไม่เคยมีมาก่อน -> สร้างแถวใหม่ให้เลย แล้วออกรหัสล็อตประจำแถวนี้ทันที
				sup.ProductID = productID
				if err := tx.Create(&sup).Error; err != nil {
					return err
				}
				if err := assignVariantCode(tx, &sup); err != nil {
					return err
				}
			} else {
				return err
			}

			movement := entity.StockMovement{
				Movement_Type:     "IN",
				Quantity:          sup.Inventory_Quantity,
				Movement_DateTime: sup.Last_Updated_DateTime,
				ProductID:         productID,
				SupplierID:        &sup.SupplierID,
			}
			if err := tx.Create(&movement).Error; err != nil {
				return err
			}
		}

		// ไม่ได้แยกตาม Supplier มา -> บันทึกเป็นรายการเดียวรวมจำนวนทั้งหมดที่รับเข้า
		if len(suppliers) == 0 {
			movement := entity.StockMovement{
				Movement_Type:     "IN",
				Quantity:          addedQty,
				Movement_DateTime: time.Now(),
				ProductID:         productID,
			}
			if err := tx.Create(&movement).Error; err != nil {
				return err
			}
		}

		return nil
	})
}
