package import_data

import (
	"backend/internal/app/entity"
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
					INSERT INTO product_mapping_corrections (ai_product_name, ai_product_code, user_product_name, user_product_code, product_id, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, NOW(), NOW())
					ON CONFLICT (ai_product_name, ai_product_code) 
					DO UPDATE SET user_product_name = EXCLUDED.user_product_name, user_product_code = EXCLUDED.user_product_code, product_id = EXCLUDED.product_id, updated_at = NOW()
				`
				if err := tx.Exec(sqlStr, aiName, aiCode, items[i].CompanyProductName, items[i].CompanyProductCode, items[i].ProductID).Error; err != nil {
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