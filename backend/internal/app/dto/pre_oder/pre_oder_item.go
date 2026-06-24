package pre_order

import (
	"time"

	"backend/internal/app/entity"
)

type CreatePreOrderItemDTO struct {
	PreOrderID uint    `json:"pre_order_id" binding:"required"`
	ProductID  uint    `json:"product_id" binding:"required"`
	Quantity   int     `json:"quantity" binding:"required"`
	UnitPrice  float64 `json:"unit_price"`
}

type UpdatePreOrderItemDTO struct {
	PreOrderID *uint    `json:"pre_order_id,omitempty"`
	ProductID  *uint    `json:"product_id,omitempty"`
	Quantity   *int     `json:"quantity,omitempty"`
	UnitPrice  *float64 `json:"unit_price,omitempty"`
}

type PreOrderItemResponseDTO struct {
	ID         uint      `json:"id"`
	PreOrderID uint      `json:"pre_order_id"`
	ProductID  uint      `json:"product_id"`
	Quantity   int       `json:"quantity"`
	UnitPrice  float64   `json:"unit_price"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

func (d *CreatePreOrderItemDTO) ToEntity() entity.PreOrderItem {
	return entity.PreOrderItem{
		PreOrderID: d.PreOrderID,
		ProductID:  d.ProductID,
		Quantity:   d.Quantity,
		UnitPrice:  d.UnitPrice,
	}
}

func (d *UpdatePreOrderItemDTO) ToEntity(existing entity.PreOrderItem) entity.PreOrderItem {
	if d.PreOrderID != nil {
		existing.PreOrderID = *d.PreOrderID
	}
	if d.ProductID != nil {
		existing.ProductID = *d.ProductID
	}
	if d.Quantity != nil {
		existing.Quantity = *d.Quantity
	}
	if d.UnitPrice != nil {
		existing.UnitPrice = *d.UnitPrice
	}
	return existing
}

func ToPreOrderItemResponseDTO(m *entity.PreOrderItem) PreOrderItemResponseDTO {
	return PreOrderItemResponseDTO{
		ID:         m.ID,
		PreOrderID: m.PreOrderID,
		ProductID:  m.ProductID,
		Quantity:   m.Quantity,
		UnitPrice:  m.UnitPrice,
		CreatedAt:  m.CreatedAt,
		UpdatedAt:  m.UpdatedAt,
	}
}
