package claim

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type POLookupRepository interface {
	GetPOByNumber(poNumber string) (*entity.PO, error)
}

type poLookupRepository struct {
	db *gorm.DB
}

func NewPOLookupRepository(db *gorm.DB) POLookupRepository {
	return &poLookupRepository{db: db}
}

func (r *poLookupRepository) GetPOByNumber(poNumber string) (*entity.PO, error) {
	var po entity.PO
	err := r.db.Preload("Supplier").
		Preload("PO_Items").
		Where("po_number = ?", poNumber).
		First(&po).Error
	if err != nil {
		return nil, err
	}
	return &po, nil
}
