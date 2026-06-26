package claim

import (
	"time"

	"backend/internal/app/entity"
)
	// SalesReturnID uint         `gorm:"not null;index" json:"sales_return_id"`
	// SalesReturn   *SalesReturn `gorm:"foreignKey:SalesReturnID" json:"sales_return,omitempty"`
	// ProductID     uint         `gorm:"not null;index" json:"product_id"`
	// Product       *Product     `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	// Quantity      int          `gorm:"not null" json:"quantity"`
	// UnitPrice     float64      `gorm:"not null" json:"unit_price"`
type CreateSalesReturnItemDTO struct {
	SalesReturnID uint    `json:"sales_return_id" binding:"required"`
	ProductID     uint    `json:"product_id" binding:"required"`
	Quantity      int     `json:"quantity" binding:"required"`
	UnitPrice     float64 `json:"unit_price" binding:"required"`
}

type UpdateSalesReturnItemDTO struct {
	SalesReturnID uint    `json:"sales_return_id" binding:"required"`
	ProductID     uint    `json:"product_id" binding:"required"`
	Quantity      int     `json:"quantity" binding:"required"`
	UnitPrice     float64 `json:"unit_price" binding:"required"`
}

type SalesReturnItemResponseDTO struct {
	ID            uint      `json:"id"`
	SalesReturnID uint      `json:"sales_return_id"`
	ProductID     uint      `json:"product_id"`
	Quantity      int       `json:"quantity"`
	UnitPrice     float64   `json:"unit_price"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

func (d *CreateSalesReturnItemDTO) ToEntity() entity.SalesReturnItem {
	return entity.SalesReturnItem{
		SalesReturnID: d.SalesReturnID,
		ProductID:     d.ProductID,
		Quantity:      d.Quantity,
		UnitPrice:     d.UnitPrice,
	}
}

func (d *UpdateSalesReturnItemDTO) ToEntity(id uint) entity.SalesReturnItem {
	return entity.SalesReturnItem{
		SalesReturnID: d.SalesReturnID,
		ProductID:     d.ProductID,
		Quantity:      d.Quantity,
		UnitPrice:     d.UnitPrice,
	}
}

func ToSalesReturnItemResponseDTO(m *entity.SalesReturnItem) SalesReturnItemResponseDTO {
	return SalesReturnItemResponseDTO{
		ID:            m.ID,
		SalesReturnID: m.SalesReturnID,
		ProductID:     m.ProductID,
		Quantity:      m.Quantity,
		UnitPrice:     m.UnitPrice,
		CreatedAt:     m.CreatedAt,
		UpdatedAt:     m.UpdatedAt,
	}
}
