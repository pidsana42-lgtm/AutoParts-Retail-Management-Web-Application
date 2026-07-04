package wms

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type UnitRepository interface {
	Create(unit *entity.Unit) error
	GetByID(id uint) (*entity.Unit, error)
	List() ([]entity.Unit, error)
	Update(unit *entity.Unit) error
	Delete(id uint) error
}

type unitRepository struct {
	db *gorm.DB
}

func NewUnitRepository(db *gorm.DB) UnitRepository {
	return &unitRepository{db: db}
}

func (r *unitRepository) Create(unit *entity.Unit) error {
	return r.db.Create(unit).Error
}

func (r *unitRepository) GetByID(id uint) (*entity.Unit, error) {
	var unit entity.Unit
	err := r.db.First(&unit, id).Error
	if err != nil {
		return nil, err
	}
	return &unit, nil
}

func (r *unitRepository) List() ([]entity.Unit, error) {
	var list []entity.Unit
	return list, r.db.Order("created_at desc").Find(&list).Error
}

func (r *unitRepository) Update(unit *entity.Unit)error {
	return r.db.Save(unit).Error
}

func (r *unitRepository) Delete(id uint) error {
	return r.db.Delete(&entity.Unit{}, id).Error
}