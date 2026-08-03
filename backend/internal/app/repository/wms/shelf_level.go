package wms

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type ShelfLevelRepository interface {
	Create(level *entity.ShelfLevel) error
	GetByID(id uint) (*entity.ShelfLevel, error)
	Update(level *entity.ShelfLevel) error
	Delete(id uint) error
}

type shelfLevelRepository struct {
	db *gorm.DB
}

func NewShelfLevelRepository(db *gorm.DB) ShelfLevelRepository {
	return &shelfLevelRepository{db: db}
}

func (r *shelfLevelRepository) Create(level *entity.ShelfLevel) error {
	return r.db.Create(level).Error
}

func (r *shelfLevelRepository) GetByID(id uint) (*entity.ShelfLevel, error) {
	var level entity.ShelfLevel
	err := r.db.First(&level, id).Error
	if err != nil {
		return nil, err
	}
	return &level, nil
}

func (r *shelfLevelRepository) Update(level *entity.ShelfLevel) error {
	return r.db.Save(level).Error
}

func (r *shelfLevelRepository) Delete(id uint) error {
	return r.db.Delete(&entity.ShelfLevel{}, id).Error
}
