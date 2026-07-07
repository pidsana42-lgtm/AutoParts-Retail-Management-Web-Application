package purchaseorders

import (
	poEntity "backend/internal/app/entity"
	"context"
	"gorm.io/gorm"
)

// SupplierRepository คุมตาราง suppliers
type SupplierRepository interface {
	GetSupplierByID(ctx context.Context, id uint) (*poEntity.Supplier, error)
}

type supplierRepository struct {
	db *gorm.DB
}

func NewSupplierRepository(db *gorm.DB) SupplierRepository {
	return &supplierRepository{db: db}
}

func (r *supplierRepository) GetSupplierByID(ctx context.Context, id uint) (*poEntity.Supplier, error) {
	var supplier poEntity.Supplier

	err := r.db.WithContext(ctx).First(&supplier, id).Error
	if err != nil {
		return nil, err
	}

	return &supplier, nil
}
