package wms

import (
	"time"

	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type StockMovementRepository interface {
	Create(sm *entity.StockMovement) error
	GetByID(id uint) (*entity.StockMovement, error)
	List(movementType string, from, to *time.Time) ([]entity.StockMovement, error)
}

type stockMovementRepository struct {
	db *gorm.DB
}

func NewStockMovementRepository(db *gorm.DB) StockMovementRepository {
	return &stockMovementRepository{db: db}
}

func (r *stockMovementRepository) Create(sm *entity.StockMovement) error {
	return r.db.Create(sm).Error
}

func (r *stockMovementRepository) GetByID(id uint) (*entity.StockMovement, error) {
	var sm entity.StockMovement
	err := r.db.Preload("Product").Preload("Supplier").Preload("User").First(&sm, id).Error
	if err != nil {
		return nil, err
	}
	return &sm, nil
}

func (r *stockMovementRepository) List(movementType string, from, to *time.Time) ([]entity.StockMovement, error) {
	var list []entity.StockMovement
	query := r.db.Preload("Product").Preload("Supplier").Preload("User")
	if movementType != "" {
		query = query.Where("movement_type = ?", movementType)
	}
	if from != nil {
		query = query.Where("movement_date_time >= ?", *from)
	}
	if to != nil {
		query = query.Where("movement_date_time <= ?", *to)
	}
	return list, query.Order("movement_date_time desc").Find(&list).Error
}
