package purchaseorders

import (
	"context"
	poEntity "backend/internal/app/entity"
)

func (r *supplierRepository) GetSupplierByID(ctx context.Context, id uint) (*poEntity.Supplier, error) {
	var supplier poEntity.Supplier

	err := r.db.WithContext(ctx).First(&supplier, id).Error
	if err != nil {
		return nil, err
	}

	return &supplier, nil
}