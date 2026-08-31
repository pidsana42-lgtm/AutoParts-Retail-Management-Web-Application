package entity

import "gorm.io/gorm"

type SalesReturnItem struct {
	gorm.Model
	SalesReturnID uint         `gorm:"not null;index" json:"sales_return_id"`
	SalesReturn   *SalesReturn `gorm:"foreignKey:SalesReturnID" json:"sales_return,omitempty"`
	ProductID     uint         `gorm:"not null;index" json:"product_id"`
	Product       *Product     `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Quantity      int          `gorm:"not null" json:"quantity"`
	UnitPrice     float64      `gorm:"type:decimal(15,2);not null" json:"unit_price"`
	Subtotal      float64      `gorm:"type:decimal(15,2);not null;default:0.00" json:"subtotal"`
}
