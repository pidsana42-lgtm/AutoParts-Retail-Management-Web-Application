package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type SubCategoryRepository interface {
	Create(subCat *entity.SubCategory) error
	GetByID(id uint) (*entity.SubCategory, error)
	List(categoryID *uint) ([]entity.SubCategory, error)
	Update(subCat *entity.SubCategory) error
	Delete(id uint) error
}

type subCategoryRepository struct {
	db *gorm.DB
}

func NewSubCategoryRepository(db *gorm.DB) SubCategoryRepository {
	return &subCategoryRepository{db: db}
}

func (r *subCategoryRepository) Create(subCat *entity.SubCategory) error {
	return r.db.Create(subCat).Error
}

func (r *subCategoryRepository) GetByID(id uint) (*entity.SubCategory, error) {
	var subCat entity.SubCategory
	err := r.db.Preload("Category").First(&subCat, id).Error
	if err != nil {
		return nil, err
	}
	return &subCat, nil
}

func (r *subCategoryRepository) List(categoryID *uint) ([]entity.SubCategory, error) {
	var list []entity.SubCategory
	query := r.db.Preload("Category")
	if categoryID != nil {
		query = query.Where("category_id = ?", *categoryID)
	}
	return list, query.Order("created_at desc").Find(&list).Error
}

func (r *subCategoryRepository) Update(subCat *entity.SubCategory) error {
	return r.db.Save(subCat).Error
}

func (r *subCategoryRepository) Delete(id uint) error {
	return r.db.Delete(&entity.SubCategory{}, id).Error
}