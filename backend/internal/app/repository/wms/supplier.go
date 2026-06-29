package wms

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type SupplierRepository interface {
	Create(supplier *entity.Supplier) error
	GetByID(id uint) (*entity.Supplier, error)
	Update(supplier *entity.Supplier) error
	Delete(id uint) error
	List() ([]entity.Supplier, error)
}

type supplierRepository struct {
	db *gorm.DB
}

func NewSupplierRepository(db *gorm.DB) SupplierRepository {
	return &supplierRepository{db: db}
}

func (r *supplierRepository) Create(supplier *entity.Supplier) error {
	return r.db.Create(supplier).Error
}

func (r *supplierRepository) GetByID(id uint) (*entity.Supplier, error) {
	var supplier entity.Supplier
	err := r.db.First(&supplier, id).Error
	if err != nil {
		return nil, err
	}
	return &supplier, nil
}

func (r *supplierRepository) Update(supplier *entity.Supplier) error {
	return r.db.Save(supplier).Error
}

func (r *supplierRepository) Delete(id uint) error {
	return r.db.Delete(&entity.Supplier{}, id).Error
}

func (r *supplierRepository) List() ([]entity.Supplier, error) {
	var suppliers []entity.Supplier
	err := r.db.Find(&suppliers).Error
	return suppliers, err
}
