package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type SubSubCategoryRepository interface {
	Create(subSubCat *entity.SubSubCategory) error
	GetByID(id uint) (*entity.SubSubCategory, error)
	List(subCategoryID *uint) ([]entity.SubSubCategory, error)
	Update(subSubCat *entity.SubSubCategory) error
	Delete(id uint) error
}

type subSubCategoryRepository struct {
	db *gorm.DB
}

func NewSubSubCategoryRepository(db *gorm.DB) SubSubCategoryRepository {
	return &subSubCategoryRepository{db: db}
}

func (r *subSubCategoryRepository) Create(subSubCat *entity.SubSubCategory) error {
	return r.db.Create(subSubCat).Error
}

func (r *subSubCategoryRepository) GetByID(id uint) (*entity.SubSubCategory, error) {
	var subSubCat entity.SubSubCategory
	err := r.db.Preload("SubCategory").First(&subSubCat, id).Error
	if err != nil {
		return nil, err
	}
	return &subSubCat, nil
}

func (r *subSubCategoryRepository) List(subCategoryID *uint) ([]entity.SubSubCategory, error) {
	var list []entity.SubSubCategory
	query := r.db.Preload("SubCategory")
	if subCategoryID != nil {
		query = query.Where("sub_category_id = ?", *subCategoryID)
	}

	return list, query.Order("created_at desc").Find(&list).Error
}

func (r *subSubCategoryRepository) Update(subSubCat *entity.SubSubCategory) error {
	return r.db.Save(subSubCat).Error
}

func (r *subSubCategoryRepository) Delete(id uint) error {
	return r.db.Delete(&entity.SubSubCategory{}, id).Error
}