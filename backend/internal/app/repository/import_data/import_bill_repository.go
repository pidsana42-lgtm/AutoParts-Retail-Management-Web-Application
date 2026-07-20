package import_data

import (
	"backend/internal/app/entity"
	"errors"

	"gorm.io/gorm"
)

// BillRepository interface สำหรับเป็นประตูผ่านไปฐานข้อมูลของระบบ Bill ทุกตาราง
type BillRepository interface {
	CreateBill(bill *entity.Bill) error
	GetBillByID(id uint) (*entity.Bill, error)
	ListBills() ([]entity.Bill, error)
	CreateBillImage(img *entity.BillImage) error
	CreateBillImportJob(job *entity.BillImportJob) error
	GetBillImportJobByID(id uint) (*entity.BillImportJob, error)
	SaveBillImportJob(job *entity.BillImportJob) error
	CreateBillItem(item *entity.BillItem) error
	ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob) error
	UpdateBill(id uint, bill *entity.Bill, items []entity.BillItem) error
	DeleteBill(id uint) error
}

type billRepository struct {
	db *gorm.DB
}

func NewBillRepository(db *gorm.DB) BillRepository {
	return &billRepository{db: db}
}

func (r *billRepository) CreateBill(bill *entity.Bill) error {
	return r.db.Create(bill).Error
}

func (r *billRepository) GetBillByID(id uint) (*entity.Bill, error) {
	var bill entity.Bill
	err := r.db.Preload("BillItems").
		Preload("BillImage").
		Preload("VerifiedByUser").
		Preload("PO").
		First(&bill, id).Error
	if err != nil {
		return nil, err
	}
	return &bill, nil
}

func (r *billRepository) ListBills() ([]entity.Bill, error) {
	var bills []entity.Bill
	err := r.db.Preload("BillImage").
		Preload("VerifiedByUser").
		Preload("PO").
		Preload("BillItems").
		Find(&bills).Error
	return bills, err
}

func (r *billRepository) CreateBillImage(img *entity.BillImage) error {
	return r.db.Create(img).Error
}

func (r *billRepository) CreateBillImportJob(job *entity.BillImportJob) error {
	return r.db.Create(job).Error
}

func (r *billRepository) GetBillImportJobByID(id uint) (*entity.BillImportJob, error) {
	var job entity.BillImportJob
	err := r.db.First(&job, id).Error
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *billRepository) SaveBillImportJob(job *entity.BillImportJob) error {
	return r.db.Save(job).Error
}

func (r *billRepository) CreateBillItem(item *entity.BillItem) error {
	return r.db.Create(item).Error
}

func (r *billRepository) ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(bill).Error; err != nil {
			return err
		}

		for i := range items {
			items[i].BillID = bill.ID

			// 1. Check if product exists in products table by name or code
			var prod entity.Product
			err := tx.Where("product_name = ? OR (product_code = ? AND product_code != '')", items[i].CompanyProductName, items[i].CompanyProductCode).First(&prod).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// 2. If it does not exist, insert it into products table first
				catID := uint(1)
				if items[i].CategoryID != nil && *items[i].CategoryID > 0 {
					catID = *items[i].CategoryID
				}
				var subCatID *uint
				if items[i].SubCategoryID != nil && *items[i].SubCategoryID > 0 {
					subCatID = items[i].SubCategoryID
				}

				newProd := entity.Product{
					Product_Name:   items[i].CompanyProductName,
					Product_Code:   "",                          // Leave blank to trigger BeforeCreate GORM hook auto-generation
					Part_Number:    items[i].CompanyProductCode, // Store supplier code in Part_Number
					Barcode:        "",                          // Leave blank to match the auto-generated code
					Cost_price:     items[i].PricePerUnit,
					Sale_price:     items[i].PricePerUnit * 1.25, // default markup 25%
					Is_Active:      true,
					Quantity:       items[i].OrderQuantity, // Set initial quantity from bill
					Limit_Quantity: 5,
					BrandID:        1, // Default Brand ID
					UnitID:         1, // Default Unit ID
					CategoryID:     catID,
					SubCategoryID:  subCatID,
					GradeID:        1, // Default Grade ID
					ShelfID:        1, // Default Shelf ID
				}
				if err := tx.Create(&newProd).Error; err != nil {
					return err
				}
				prod = newProd
			} else if err == nil {
				// 3. If it exists, increment its quantity by order quantity
				if err := tx.Model(&prod).Update("quantity", prod.Quantity+items[i].OrderQuantity).Error; err != nil {
					return err
				}
			} else {
				return err
			}

			// Assign the found/created product ID to this bill item
			items[i].ProductID = prod.ID

			if err := tx.Create(&items[i]).Error; err != nil {
				return err
			}

			// Active learning: Save/update the verified mapping correction in Postgres
			if items[i].ProductID > 0 {
				aiName := items[i].AIProductName
				if aiName == "" {
					aiName = items[i].CompanyProductName
				}
				aiCode := items[i].AIProductCode
				if aiCode == "" {
					aiCode = items[i].CompanyProductCode
				}

				sqlStr := `
					INSERT INTO product_mapping_corrections (supplier_id, ai_product_name, ai_product_code, user_product_name, user_product_code, product_id, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
					ON CONFLICT (supplier_id, ai_product_name, ai_product_code) 
					DO UPDATE SET user_product_name = EXCLUDED.user_product_name, user_product_code = EXCLUDED.user_product_code, product_id = EXCLUDED.product_id, updated_at = NOW()
				`
				if err := tx.Exec(sqlStr, bill.SupplierID, aiName, aiCode, items[i].CompanyProductName, items[i].CompanyProductCode, items[i].ProductID).Error; err != nil {
					println("Warning: failed to save product mapping correction: ", err.Error())
				}
			}
		}

		return tx.Save(job).Error
	})
}

func (r *billRepository) UpdateBill(id uint, bill *entity.Bill, items []entity.BillItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Update Bill details
		if err := tx.Model(&entity.Bill{}).Where("id = ?", id).Updates(bill).Error; err != nil {
			return err
		}
		// Delete existing Bill items and recreate them
		if err := tx.Where("bill_id = ?", id).Delete(&entity.BillItem{}).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].BillID = id
			if err := tx.Create(&items[i]).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

func (r *billRepository) DeleteBill(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// Delete BillItems first
		if err := tx.Where("bill_id = ?", id).Delete(&entity.BillItem{}).Error; err != nil {
			return err
		}
		// Delete Bill itself
		if err := tx.Delete(&entity.Bill{}, id).Error; err != nil {
			return err
		}
		return nil
	})
}
