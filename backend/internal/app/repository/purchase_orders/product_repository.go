package purchaseorders

import (
	"context"
	poEntity "backend/internal/app/entity"
)

func (r *productRepository) GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error) {
	var product poEntity.Product

	err := r.db.WithContext(ctx).Preload("Unit").First(&product, id).Error
	if err != nil {
		return nil, err
	}

	return &product, nil
}