package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type CheckStockScheduleRepository interface {
	Create(schedule *entity.CheckStockSchedule) error
	GetByID(id uint) (*entity.CheckStockSchedule, error)
	UpdateStatus(id uint, status string) error
	Update(schedule *entity.CheckStockSchedule) error
	Delete(id uint) error
	List(status string) ([]entity.CheckStockSchedule, error)
}

type checkStockScheduleRepository struct {
	db *gorm.DB
}

func NewCheckStockScheduleRepository(db *gorm.DB) CheckStockScheduleRepository {
	return &checkStockScheduleRepository{db: db}
}

func (r *checkStockScheduleRepository) Create(schedule *entity.CheckStockSchedule) error {
	return r.db.Create(schedule).Error
}

func (r *checkStockScheduleRepository) GetByID(id uint) (*entity.CheckStockSchedule, error) {
	var s entity.CheckStockSchedule
	err := r.db.Preload("User").First(&s, id).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *checkStockScheduleRepository) UpdateStatus(id uint, status string) error {
	return r.db.Model(&entity.CheckStockSchedule{}).Where("id = ?", id).Update("status", status).Error
}

func (r *checkStockScheduleRepository) Update(schedule *entity.CheckStockSchedule) error {
	return r.db.Save(schedule).Error
}

func (r *checkStockScheduleRepository) Delete(id uint) error {
	return r.db.Delete(&entity.CheckStockSchedule{}, id).Error
}

func (r *checkStockScheduleRepository) List(status string) ([]entity.CheckStockSchedule, error) {
	var schedules []entity.CheckStockSchedule
	query := r.db.Model(&entity.CheckStockSchedule{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	return schedules, query.Preload("User").Order("scheduled_date_time asc").Find(&schedules).Error
}
