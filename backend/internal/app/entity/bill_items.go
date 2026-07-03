package entity

import "gorm.io/gorm"

type BillItem struct {
	gorm.Model
	BillID             uint     `gorm:"not null;index" json:"bill_id"`
	Bill               *Bill    `gorm:"foreignKey:BillID" json:"bill,omitempty"`
	ItemSequence       uint     `gorm:"not null;index" json:"item_sequence"`
	CompanyProductCode string   `gorm:"not null" json:"company_product_code"`
	CompanyProductName string   `gorm:"not null" json:"company_product_name"`
	OrderQuantity      int      `gorm:"not null" json:"order_quantity"`
	Unit               string   `gorm:"not null" json:"unit"`
	ConversionFactor   float64  `gorm:"not null" json:"conversion_factor"`
	PricePerUnit       float64  `gorm:"not null" json:"price_per_unit"`
	DiscountAmount     float64  `gorm:"not null" json:"discount_amount"`
	NetAmount          float64  `gorm:"not null" json:"net_amount"`
	IsFreebie          bool     `gorm:"not null" json:"is_freebie"`
	Remark             string   `gorm:"type:text" json:"remark"`
	AIProductCode      string   `gorm:"type:varchar(255)" json:"ai_product_code"`
	AIProductName      string   `gorm:"type:varchar(255)" json:"ai_product_name"`
	ProductID          uint     `gorm:"not null;index" json:"product_id"`
	Product            *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
