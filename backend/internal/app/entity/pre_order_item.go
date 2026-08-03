package entity

import "gorm.io/gorm"

type PreOrderItem struct {
	gorm.Model
	PreOrderID uint      `gorm:"not null;index" json:"pre_order_id"`
	PreOrder   *PreOrder `gorm:"foreignKey:PreOrderID" json:"pre_order,omitempty"`
	ProductID  uint      `gorm:"not null;index" json:"product_id"`
	Product    *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Quantity   int       `gorm:"not null" json:"quantity"`
	UnitPrice  float64   `gorm:"not null" json:"unit_price"`
	Status     string    `gorm:"not null;default:'PENDING'" json:"status"`
}
