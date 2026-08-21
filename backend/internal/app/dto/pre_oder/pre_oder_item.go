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
	ID          uint      `json:"id"`
	PreOrderID  uint      `json:"pre_order_id"`
	ProductID   uint      `json:"product_id"`
	ProductName string    `json:"product_name,omitempty"`
	ProductCode string    `json:"product_code,omitempty"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
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
	prodName := ""
	prodCode := ""
	if m.Product != nil {
		prodName = m.Product.Product_Name
		prodCode = m.Product.Product_Code
	}

	return PreOrderItemResponseDTO{
		ID:          m.ID,
		PreOrderID:  m.PreOrderID,
		ProductID:   m.ProductID,
		ProductName: prodName,
		ProductCode: prodCode,
		Quantity:    m.Quantity,
		UnitPrice:   m.UnitPrice,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}

// แยก Struct ใหม่มาใช้เฉพาะหน้าเลือก PreOrder เข้า PO
type PreOrderItemForPODTO struct {
	ID          uint      `json:"id"`
	PreOrderID  uint      `json:"pre_order_id"`
	ProductID   uint      `json:"product_id"`
	ProductCode string    `json:"product_code"`
	ProductName string    `json:"product_name"`
	Unit        string    `json:"unit"`
	Quantity    int       `json:"quantity"`
	UnitPrice   float64   `json:"unit_price"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ฟังก์ชัน Map สำหรับ DTO ตัวใหม่
func ToPreOrderItemForPODTO(m *entity.PreOrderItem) PreOrderItemForPODTO {
	var pCode, pName, pUnit string
	if m.Product != nil {
		pCode = m.Product.Product_Code
		pName = m.Product.Product_Name
		if m.Product.Unit != nil {
			pUnit = m.Product.Unit.Unit_Name
		}
	}

	return PreOrderItemForPODTO{
		ID:          m.ID,
		PreOrderID:  m.PreOrderID,
		ProductID:   m.ProductID,
		ProductCode: pCode,
		ProductName: pName,
		Unit:        pUnit,
		Quantity:    m.Quantity,
		UnitPrice:   m.UnitPrice,
		Status:      m.Status,
		CreatedAt:   m.CreatedAt,
		UpdatedAt:   m.UpdatedAt,
	}
}