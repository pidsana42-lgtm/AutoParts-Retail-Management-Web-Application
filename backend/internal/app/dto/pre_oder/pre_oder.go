package pre_order

import (
	"time"

	"backend/internal/app/entity"
)

type CreatePreOrderDTO struct {
	PreOrderType  string    `json:"pre_order_type" binding:"required"`
	CustomerID    uint      `json:"customer_id" binding:"required"`
	DepositAmount float64   `json:"deposit_amount"`
	Status        string    `json:"status" binding:"required"`
	OrderDate     time.Time `json:"order_date" binding:"required"`
	SupplierID    uint      `json:"supplier_id" binding:"required"`
}

type UpdatePreOrderDTO struct {
	PreOrderType  *string    `json:"pre_order_type,omitempty"`
	CustomerID    *uint      `json:"customer_id,omitempty"`
	DepositAmount *float64   `json:"deposit_amount,omitempty"`
	Status        *string    `json:"status,omitempty"`
	OrderDate     *time.Time `json:"order_date,omitempty"`
	SupplierID    *uint      `json:"supplier_id,omitempty"`
}

type PreOrderResponseDTO struct {
	ID            uint      `json:"id"`
	PreOrderType  string    `json:"pre_order_type"`
	CustomerID    uint      `json:"customer_id"`
	DepositAmount float64   `json:"deposit_amount"`
	Status        string    `json:"status"`
	OrderDate     time.Time `json:"order_date"`
	SupplierID    uint      `json:"supplier_id"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (d *CreatePreOrderDTO) ToEntity() entity.PreOrder {
	return entity.PreOrder{
		PreOrderType:  d.PreOrderType,
		CustomerID:    d.CustomerID,
		DepositAmount: d.DepositAmount,
		Status:        d.Status,
		OrderDate:     d.OrderDate,
		SupplierID:    d.SupplierID,
	}
}

func (d *UpdatePreOrderDTO) ToEntity(existing entity.PreOrder) entity.PreOrder {
	if d.PreOrderType != nil {
		existing.PreOrderType = *d.PreOrderType
	}
	if d.CustomerID != nil {
		existing.CustomerID = *d.CustomerID
	}
	if d.DepositAmount != nil {
		existing.DepositAmount = *d.DepositAmount
	}
	if d.Status != nil {
		existing.Status = *d.Status
	}
	if d.OrderDate != nil {
		existing.OrderDate = *d.OrderDate
	}
	if d.SupplierID != nil {
		existing.SupplierID = *d.SupplierID
	}
	return existing
}

func ToPreOrderResponseDTO(m *entity.PreOrder) PreOrderResponseDTO {
	return PreOrderResponseDTO{
		ID:            m.ID,
		PreOrderType:  m.PreOrderType,
		CustomerID:    m.CustomerID,
		DepositAmount: m.DepositAmount,
		Status:        m.Status,
		OrderDate:     m.OrderDate,
		SupplierID:    m.SupplierID,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}
