package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type ProductRepository interface {
	CreateProduct(product *entity.Product) error
	GetProductByID(id uint) (*entity.Product, error)
	UpdateProduct(product *entity.Product) error
	DeleteProduct(id uint) error
	ListProducts() ([]entity.Product, error)
	ListBrands() ([]entity.Brand, error)
	CreateBrand(brand *entity.Brand) error
	UpdateBrand(brand *entity.Brand) error
	DeleteBrand(id uint) error

	CreateModel(model *entity.Models) error
	UpdateModel(model *entity.Models) error
	DeleteModel(id uint) error

	ListGrades() ([]entity.Grade, error)
}

type productRepository struct {
	db *gorm.DB
}

func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

func (r *productRepository) CreateProduct(product *entity.Product) error {
	return r.db.Create(product).Error
}

func (r *productRepository) GetProductByID(id uint) (*entity.Product, error) {
	var product entity.Product
	err := r.db.Preload("Models").Preload("Models.Brand").Preload("Category").Preload("Grade").Preload("Unit").Preload("Shelf").Preload("ProductImages").Preload("Inventories.Supplier").
		First(&product, id).Error
	if err != nil {
		return nil, err
	}
	return &product, nil
}

func (r *productRepository) UpdateProduct(product *entity.Product) error {
	err := r.db.Save(product).Error
	if err != nil {
		return err
	}
	return r.db.Model(product).Association("Models").Replace(product.Models)
}

func (r *productRepository) DeleteProduct(id uint) error {
	return r.db.Delete(&entity.Product{}, id).Error
}

func (r *productRepository) ListProducts() ([]entity.Product, error) {
	var products []entity.Product
	err := r.db.Preload("Models").Preload("Models.Brand").Preload("Category").Preload("Grade").Preload("Unit").Preload("Shelf").Preload("ProductImages").Preload("Inventories.Supplier").
		Find(&products).Error
	return products, err
}

func (r *productRepository) ListBrands() ([]entity.Brand, error) {
	var brands []entity.Brand
	err := r.db.Preload("Models").Order("brand_name asc").Find(&brands).Error
	return brands, err
}

func (r *productRepository) ListGrades() ([]entity.Grade, error) {
	var grades []entity.Grade
	err := r.db.Order("grade_name asc").Find(&grades).Error
	return grades, err
}

func (r *productRepository) CreateBrand(brand *entity.Brand) error {
	return r.db.Create(brand).Error
}

func (r *productRepository) UpdateBrand(brand *entity.Brand) error {
	return r.db.Save(brand).Error
}

func (r *productRepository) DeleteBrand(id uint) error {
	return r.db.Delete(&entity.Brand{}, id).Error
}

func (r *productRepository) CreateModel(model *entity.Models) error {
	return r.db.Create(model).Error
}

func (r *productRepository) UpdateModel(model *entity.Models) error {
	return r.db.Save(model).Error
}

func (r *productRepository) DeleteModel(id uint) error {
	return r.db.Delete(&entity.Models{}, id).Error
}
