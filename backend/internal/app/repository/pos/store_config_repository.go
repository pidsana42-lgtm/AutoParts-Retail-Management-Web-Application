package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type StoreConfigRepository interface {
	GetStoreConfig() (*entity.StoreConfig, error)
	UpdateStoreConfig(config *entity.StoreConfig) error
}

type storeConfigRepository struct {
	db *gorm.DB
}

func NewStoreConfigRepository(db *gorm.DB) StoreConfigRepository {
	return &storeConfigRepository{db: db}
}

func (r *storeConfigRepository) GetStoreConfig() (*entity.StoreConfig, error) {
	var config entity.StoreConfig
	err := r.db.First(&config, 1).Error
	return &config, err
}

func (r *storeConfigRepository) UpdateStoreConfig(config *entity.StoreConfig) error {
	return r.db.Save(config).Error
}
