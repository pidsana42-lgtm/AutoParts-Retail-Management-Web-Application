package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type StoreConfigRepository interface {
	GetStoreConfig() (*entity.StoreConfig, error)
	CreateStoreConfig(config *entity.StoreConfig) error
	UpdateStoreConfig(config *entity.StoreConfig) error
	CreateAuditLog(log *entity.StoreConfigAuditLog) error
	GetAuditLogs(limit int) ([]entity.StoreConfigAuditLog, error)
	GetUserByID(userID uint) (*entity.User, error)
	SyncAllCustomersCreditLimit(creditLimit float64) error
}

type storeConfigRepository struct {
	db *gorm.DB
}

func NewStoreConfigRepository(db *gorm.DB) StoreConfigRepository {
	return &storeConfigRepository{db: db}
}

func (r *storeConfigRepository) GetStoreConfig() (*entity.StoreConfig, error) {
	var config entity.StoreConfig
	err := r.db.First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *storeConfigRepository) CreateStoreConfig(config *entity.StoreConfig) error {
	return r.db.Create(config).Error
}

func (r *storeConfigRepository) UpdateStoreConfig(config *entity.StoreConfig) error {
	return r.db.Save(config).Error
}

func (r *storeConfigRepository) CreateAuditLog(log *entity.StoreConfigAuditLog) error {
	return r.db.Create(log).Error
}

func (r *storeConfigRepository) GetAuditLogs(limit int) ([]entity.StoreConfigAuditLog, error) {
	var logs []entity.StoreConfigAuditLog
	if limit <= 0 {
		limit = 50
	}
	err := r.db.Order("created_at desc").Limit(limit).Find(&logs).Error
	return logs, err
}

func (r *storeConfigRepository) GetUserByID(userID uint) (*entity.User, error) {
	var user entity.User
	err := r.db.First(&user, userID).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *storeConfigRepository) SyncAllCustomersCreditLimit(creditLimit float64) error {
	return r.db.Model(&entity.Customer{}).Where("1 = 1").Update("credit_limit", creditLimit).Error
}
