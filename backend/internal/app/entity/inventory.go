package entity

import (
	"gorm.io/gorm"
	"time"
)

type Inventory struct {
	gorm.Model
	Inventory_Quantity int `json:"inventory_quantity"`
	Last_Updated_DateTime time.Time `json:"last_updated_datetime"`

	ProductID uint `json:"product_id"`
	Product *Product `gorm:"foreignKey:ProductID" json:"product"`

	SupplierID uint `json:"supplier_id"`
	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier"`
}