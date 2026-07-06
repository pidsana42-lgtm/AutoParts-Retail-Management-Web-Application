package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type StockAlertRepository interface {
	Create(sa *entity.StockAlert) error
	GetByID(id uint) (*entity.StockAlert, error)
	List(isResolved string) ([]entity.StockAlert, error)
	Update(sa *entity.StockAlert) error
}

type stockAlertRepository struct {
	db *gorm.DB
}

func NewStockAlertRepository(db *gorm.DB) StockAlertRepository {
	return &stockAlertRepository{db: db}
}

func (r *stockAlertRepository) Create(sa *entity.StockAlert) error {
	return r.db.Create(sa).Error
}

func (r *stockAlertRepository) GetByID(id uint) (*entity.StockAlert, error) {
	var sa entity.StockAlert
	err := r.db.Preload("Product").First(&sa, id).Error
	if err != nil {
		return nil, err
	}
	return &sa, nil
}

func (r *stockAlertRepository) List(isResolved string) ([]entity.StockAlert, error) {
	var list []entity.StockAlert
	query := r.db.Preload("Product")
	if isResolved != "" {
		query = query.Where("is_resolved = ?", isResolved)
	}
	return list, query.Order("created_at desc").Find(&list).Error
}

func (r *stockAlertRepository) Update(sa *entity.StockAlert) error {
	return r.db.Save(sa).Error
}
