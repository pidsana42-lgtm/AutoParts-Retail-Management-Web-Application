package entity

import "gorm.io/gorm"

type StockAlert struct {
	gorm.Model
	Alert_type string `json:"alert_type"`
	Quantity_At_Alert int `json:"quantity_at_alert"`
	Limit_Quantity int `json:"limit_quantity"`
	Is_Resolved string `json:"is_resolved"`

	ProductID *uint `json:"product_id"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product"`
}