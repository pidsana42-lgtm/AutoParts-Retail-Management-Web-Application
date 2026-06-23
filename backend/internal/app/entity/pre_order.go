package entity

import (
	"time"

	"gorm.io/gorm"
)

type PreOrder struct {
	gorm.Model
	PreOrderType  string         `gorm:"not null" json:"pre_order_type"`
	CustomerID    uint           `gorm:"not null;index" json:"customer_id"`
	Customer      *Customer      `gorm:"foreignKey:CustomerID" json:"customer,omitempty"`
	DepositAmount float64        `gorm:"not null" json:"deposit_amount"`
	Status        string         `gorm:"not null" json:"status"`
	OrderDate     time.Time      `gorm:"not null" json:"order_date"`
	SupplierID    uint           `gorm:"not null;index" json:"supplier_id"`
	Supplier      *Supplier      `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	PreOrderItems []PreOrderItem `gorm:"foreignKey:PreOrderID" json:"pre_order_items,omitempty"`
}
