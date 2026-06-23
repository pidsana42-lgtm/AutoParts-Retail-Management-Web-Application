package entity

import (
	"time"

	"gorm.io/gorm"
)

type StockMovement struct {
	gorm.Model
	Movement_Type string `json:"movement_type"`
	Quantity int `json:"quantity"`
	Movement_DateTime time.Time `json:"movement_datetime"`
	Note string `json:"note"`

	ProductID uint `json:"product_id"`
	Product *Product `gorm:"foreignKey:ProductID" json:"product"`
	SupplierID uint `json:"supplier_id"`
	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier"`
	UserID uint `json:"user_id"`
	User *User `gorm:"foreignKey:UserID" json:"user"`
	SaleOrderID uint `json:"sale_order_id"`
	SaleOrder *SaleOrder `gorm:"foreignKey:SaleOrderID" json:"sale_order"`
	BillID uint `json:"bill_id"`
	Bill *Bill `gorm:"foreignKey:BillID" json:"bill"`
}