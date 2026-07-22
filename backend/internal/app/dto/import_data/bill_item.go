package import_data

import (
	"time"

	"backend/internal/app/entity"
)

type CreateBillItemDTO struct {
	BillID             uint    `json:"bill_id"`
	ItemSequence       uint    `json:"item_sequence" binding:"required"`
	CompanyProductCode string  `json:"company_product_code" binding:"required"`
	CompanyProductName string  `json:"company_product_name" binding:"required"`
	OrderQuantity      int     `json:"order_quantity" binding:"required"`
	Unit               string  `json:"unit" binding:"required"`
	ConversionFactor   float64 `json:"conversion_factor" binding:"required"`
	PricePerUnit       float64 `json:"price_per_unit"`
	DiscountAmount     float64 `json:"discount_amount"`
	NetAmount          float64 `json:"net_amount"`
	IsFreebie          bool    `json:"is_freebie"`
	Remark             string  `json:"remark"`
	AIProductCode      string  `json:"ai_product_code"`
	AIProductName      string  `json:"ai_product_name"`
	ProductID          uint    `json:"product_id"`
	CategoryID         *uint   `json:"category_id"`
	SubCategoryID      *uint   `json:"sub_category_id"`
}

type UpdateBillItemDTO struct {
	BillID             *uint    `json:"bill_id,omitempty"`
	ItemSequence       *uint    `json:"item_sequence,omitempty"`
	CompanyProductCode *string  `json:"company_product_code,omitempty"`
	CompanyProductName *string  `json:"company_product_name,omitempty"`
	OrderQuantity      *int     `json:"order_quantity,omitempty"`
	Unit               *string  `json:"unit,omitempty"`
	ConversionFactor   *float64 `json:"conversion_factor,omitempty"`
	PricePerUnit       *float64 `json:"price_per_unit,omitempty"`
	DiscountAmount     *float64 `json:"discount_amount,omitempty"`
	NetAmount          *float64 `json:"net_amount,omitempty"`
	IsFreebie          *bool    `json:"is_freebie,omitempty"`
	Remark             *string  `json:"remark,omitempty"`
	ProductID          *uint    `json:"product_id,omitempty"`
}

type BillItemResponseDTO struct {
	ID                 uint      `json:"id"`
	BillID             uint      `json:"bill_id"`
	ItemSequence       uint      `json:"item_sequence"`
	CompanyProductCode string    `json:"company_product_code"`
	CompanyProductName string    `json:"company_product_name"`
	OrderQuantity      int       `json:"order_quantity"`
	Unit               string    `json:"unit"`
	ConversionFactor   float64   `json:"conversion_factor"`
	PricePerUnit       float64   `json:"price_per_unit"`
	DiscountAmount     float64   `json:"discount_amount"`
	NetAmount          float64   `json:"net_amount"`
	IsFreebie          bool      `json:"is_freebie"`
	Remark             string    `json:"remark"`
	ProductID          uint      `json:"product_id"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (d *CreateBillItemDTO) ToEntity() entity.BillItem {
	return entity.BillItem{
		BillID:             d.BillID,
		ItemSequence:       d.ItemSequence,
		CompanyProductCode: d.CompanyProductCode,
		CompanyProductName: d.CompanyProductName,
		OrderQuantity:      d.OrderQuantity,
		Unit:               d.Unit,
		ConversionFactor:   d.ConversionFactor,
		PricePerUnit:       d.PricePerUnit,
		DiscountAmount:     d.DiscountAmount,
		NetAmount:          d.NetAmount,
		IsFreebie:          d.IsFreebie,
		Remark:             d.Remark,
		AIProductCode:      d.AIProductCode,
		AIProductName:      d.AIProductName,
		ProductID:          d.ProductID,
		CategoryID:         d.CategoryID,
		SubCategoryID:      d.SubCategoryID,
	}
}

func (d *UpdateBillItemDTO) ToEntity(existing entity.BillItem) entity.BillItem {
	if d.BillID != nil {
		existing.BillID = *d.BillID
	}
	if d.ItemSequence != nil {
		existing.ItemSequence = *d.ItemSequence
	}
	if d.CompanyProductCode != nil {
		existing.CompanyProductCode = *d.CompanyProductCode
	}
	if d.CompanyProductName != nil {
		existing.CompanyProductName = *d.CompanyProductName
	}
	if d.OrderQuantity != nil {
		existing.OrderQuantity = *d.OrderQuantity
	}
	if d.Unit != nil {
		existing.Unit = *d.Unit
	}
	if d.ConversionFactor != nil {
		existing.ConversionFactor = *d.ConversionFactor
	}
	if d.PricePerUnit != nil {
		existing.PricePerUnit = *d.PricePerUnit
	}
	if d.DiscountAmount != nil {
		existing.DiscountAmount = *d.DiscountAmount
	}
	if d.NetAmount != nil {
		existing.NetAmount = *d.NetAmount
	}
	if d.IsFreebie != nil {
		existing.IsFreebie = *d.IsFreebie
	}
	if d.Remark != nil {
		existing.Remark = *d.Remark
	}
	if d.ProductID != nil {
		existing.ProductID = *d.ProductID
	}
	return existing
}

func ToBillItemResponseDTO(m *entity.BillItem) BillItemResponseDTO {
	return BillItemResponseDTO{
		ID:                 m.ID,
		BillID:             m.BillID,
		ItemSequence:       m.ItemSequence,
		CompanyProductCode: m.CompanyProductCode,
		CompanyProductName: m.CompanyProductName,
		OrderQuantity:      m.OrderQuantity,
		Unit:               m.Unit,
		ConversionFactor:   m.ConversionFactor,
		PricePerUnit:       m.PricePerUnit,
		DiscountAmount:     m.DiscountAmount,
		NetAmount:          m.NetAmount,
		IsFreebie:          m.IsFreebie,
		Remark:             m.Remark,
		ProductID:          m.ProductID,
		CreatedAt:          m.CreatedAt,
		UpdatedAt:          m.UpdatedAt,
	}
}
