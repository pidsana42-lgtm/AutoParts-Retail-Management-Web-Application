package wms

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type ZoneRepository interface {
	Create(zone *entity.Zone) error
	GetByID(id uint) (*entity.Zone, error)
	List() ([]entity.Zone, error)
	Update(zone *entity.Zone) error
	Delete(id uint) error
}

type zoneRepository struct {
	db *gorm.DB
}

func NewZoneRepository(db *gorm.DB) ZoneRepository {
	return &zoneRepository{db: db}
}

func (r *zoneRepository) Create(zone *entity.Zone) error {
	return r.db.Create(zone).Error
}

func (r *zoneRepository) GetByID(id uint) (*entity.Zone, error) {
	var zone entity.Zone
	err := r.db.First(&zone, id).Error
	if err != nil {
		return nil, err
	}
	return &zone, nil
}

func (r *zoneRepository) List() ([]entity.Zone, error) {
	var list []entity.Zone
	return list, r.db.Order("created_at desc").Find(&list).Error
}

func (r *zoneRepository) Update(zone *entity.Zone) error {
	return r.db.Save(zone).Error
}


func (r *zoneRepository) Delete(id uint) error {
	return r.db.Delete(&entity.Zone{}, id).Error
}