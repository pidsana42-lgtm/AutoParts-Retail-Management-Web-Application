package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type CheckStockRepository interface {
	Create(cs *entity.CheckStock) error
	GetByID(id uint) (*entity.CheckStock, error)
	List(scheduleID *uint) ([]entity.CheckStock, error)
}

type checkStockRepository struct {
	db *gorm.DB
}

func NewCheckStockRepository(db *gorm.DB) CheckStockRepository {
	return &checkStockRepository{db: db}
}

func (r *checkStockRepository) Create(cs *entity.CheckStock) error {
	return r.db.Create(cs).Error
}

func (r *checkStockRepository) GetByID(id uint) (*entity.CheckStock, error) {
	var cs entity.CheckStock
	err := r.db.Preload("Product").Preload("User").First(&cs, id).Error
	if err != nil {
		return nil, err
	}
	return &cs, nil
}

func (r *checkStockRepository) List(scheduleID *uint) ([]entity.CheckStock, error) {
	var list []entity.CheckStock
	query := r.db.Preload("Product").Preload("User")
	if scheduleID != nil {
		query = query.Where("check_stock_schedule_id = ?", *scheduleID)
	}
	return list, query.Order("created_at desc").Find(&list).Error
}
