package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type CategoryRepository interface {
	Create(cat *entity.Category) error
	GetByID(id uint) (*entity.Category, error)
	List() ([]entity.Category, error)
	Update(cat *entity.Category) error
	Delete(id uint) error
}

type categoryRepository struct {
	db *gorm.DB
}

func NewCategoryRepository(db *gorm.DB) CategoryRepository {
	return &categoryRepository{db: db}
}

func (r *categoryRepository) Create(cat *entity.Category) error {
	return r.db.Create(cat).Error
}

func (r *categoryRepository) GetByID(id uint) (*entity.Category, error) {
	var cat entity.Category
	err := r.db.First(&cat, id).Error
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *categoryRepository) List() ([]entity.Category, error) {
	var list []entity.Category
	return list, r.db.Order("created_at desc").Find(&list).Error
}

func (r *categoryRepository) Update(cat *entity.Category) error {
	return r.db.Save(cat).Error
}

func (r *categoryRepository) Delete(id uint) error {
	return r.db.Delete(&entity.Category{}, id).Error
}
