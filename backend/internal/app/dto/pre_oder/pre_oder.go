package pre_order

import (
	"time"

	"backend/internal/app/entity"
)

type CreatePreOrderDTO struct {
	PreOrderType  string                  `json:"pre_order_type" binding:"required"`
	CustomerID    uint                    `json:"customer_id" binding:"required"`
	DepositAmount float64                 `json:"deposit_amount"`
	Status        string                  `json:"status" binding:"required"`
	OrderDate     time.Time               `json:"order_date" binding:"required"`
	SupplierID    uint                    `json:"supplier_id"`
	PreOrderItems []CreatePreOrderItemDTO `json:"pre_order_items"`
}

type UpdatePreOrderDTO struct {
	PreOrderType  *string                  `json:"pre_order_type,omitempty"`
	CustomerID    *uint                    `json:"customer_id,omitempty"`
	DepositAmount *float64                 `json:"deposit_amount,omitempty"`
	Status        *string                  `json:"status,omitempty"`
	OrderDate     *time.Time               `json:"order_date,omitempty"`
	SupplierID    *uint                    `json:"supplier_id,omitempty"`
	PreOrderItems *[]CreatePreOrderItemDTO `json:"pre_order_items,omitempty"`
}

type PreOrderResponseDTO struct {
	ID            uint                      `json:"id"`
	PreOrderType  string                    `json:"pre_order_type"`
	CustomerID    uint                      `json:"customer_id"`
	CustomerName  string                    `json:"customer_name,omitempty"`
	CustomerPhone string                    `json:"customer_phone,omitempty"`
	DepositAmount float64                   `json:"deposit_amount"`
	Status        string                    `json:"status"`
	OrderDate     time.Time                 `json:"order_date"`
	SupplierID    uint                      `json:"supplier_id"`
	SupplierName  string                    `json:"supplier_name,omitempty"`
	PreOrderItems []PreOrderItemResponseDTO `json:"pre_order_items"`
	CreatedAt     time.Time                 `json:"created_at"`
	UpdatedAt     time.Time                 `json:"updated_at"`
}

func (d *CreatePreOrderDTO) ToEntity() entity.PreOrder {
	var items []entity.PreOrderItem
	for _, item := range d.PreOrderItems {
		items = append(items, entity.PreOrderItem{
			ProductID: item.ProductID,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
		})
	}

	supplierID := d.SupplierID
	if supplierID == 0 {
		supplierID = 1
	}

	return entity.PreOrder{
		PreOrderType:  d.PreOrderType,
		CustomerID:    d.CustomerID,
		DepositAmount: d.DepositAmount,
		Status:        d.Status,
		OrderDate:     d.OrderDate,
		SupplierID:    supplierID,
		PreOrderItems: items,
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
	if d.PreOrderItems != nil {
		var items []entity.PreOrderItem
		for _, item := range *d.PreOrderItems {
			items = append(items, entity.PreOrderItem{
				ProductID: item.ProductID,
				Quantity:  item.Quantity,
				UnitPrice: item.UnitPrice,
			})
		}
		existing.PreOrderItems = items
	}
	return existing
}

func ToPreOrderResponseDTO(m *entity.PreOrder) PreOrderResponseDTO {
	var items []PreOrderItemResponseDTO
	for _, item := range m.PreOrderItems {
		items = append(items, ToPreOrderItemResponseDTO(&item))
	}

	custName := ""
	custPhone := ""
	if m.Customer != nil {
		custName = m.Customer.CustomerName
		custPhone = m.Customer.PhoneNumber
	}

	suppName := ""
	if m.Supplier != nil {
		suppName = m.Supplier.SupplierName
	}

	return PreOrderResponseDTO{
		ID:            m.ID,
		PreOrderType:  m.PreOrderType,
		CustomerID:    m.CustomerID,
		CustomerName:  custName,
		CustomerPhone: custPhone,
		DepositAmount: m.DepositAmount,
		Status:        m.Status,
		OrderDate:     m.OrderDate,
		SupplierID:    m.SupplierID,
		SupplierName:  suppName,
		PreOrderItems: items,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}

type PreOrderForPODTO struct {
	ID            uint                   `json:"id"`
	Status        string                 `json:"status"`
	PreOrderItems []PreOrderItemForPODTO `json:"pre_order_items"` 
}

func ToPreOrderForPODTO(m *entity.PreOrder) PreOrderForPODTO {
	var items []PreOrderItemForPODTO
	for _, item := range m.PreOrderItems {
		items = append(items, ToPreOrderItemForPODTO(&item))
	}

	return PreOrderForPODTO{
		ID:            m.ID,
		Status:        m.Status,
		PreOrderItems: items,
	}
}