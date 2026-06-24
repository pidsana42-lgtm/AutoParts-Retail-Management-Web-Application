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
		}

		return tx.Save(job).Error
	})
}