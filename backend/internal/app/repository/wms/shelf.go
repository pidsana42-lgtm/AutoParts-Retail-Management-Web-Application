package wms

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type ShelfRepository interface {
	Create(shelf *entity.Shelf) error
	GetByID(id uint) (*entity.Shelf, error)
	List() ([]entity.Shelf, error)
	Update(shelf *entity.Shelf) error
	Delete(id uint) error
}

type shelfRepository struct {
	db *gorm.DB
}

func NewShelfRepository(db *gorm.DB) ShelfRepository {
	return &shelfRepository{db: db}
}

func (r *shelfRepository) Create(shelf *entity.Shelf) error {
	return r.db.Create(shelf).Error
}

func (r *shelfRepository) GetByID(id uint) (*entity.Shelf, error) {
	var shelf entity.Shelf
	err := r.db.Preload("ShelfLevels").First(&shelf, id).Error
	if err != nil {
		return nil, err
	}
	return &shelf, nil
}

func (r *shelfRepository) List() ([]entity.Shelf, error) {
	var list []entity.Shelf
	return list, r.db.Preload("ShelfLevels").Order("created_at desc").Find(&list).Error
}

func (r *shelfRepository) Update(shelf *entity.Shelf) error {
	return r.db.Save(shelf).Error
}

func (r *shelfRepository) Delete(id uint) error {
	return r.db.Delete(&entity.Shelf{}, id).Error
}