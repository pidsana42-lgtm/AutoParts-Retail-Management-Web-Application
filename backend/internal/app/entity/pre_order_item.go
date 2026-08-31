package entity

import "gorm.io/gorm"

type PreOrderItem struct {
	gorm.Model
	PreOrderID uint      `gorm:"not null;index" json:"pre_order_id"`
	PreOrder   *PreOrder `gorm:"foreignKey:PreOrderID" json:"pre_order,omitempty"`
	ProductID  uint      `gorm:"not null;index" json:"product_id"`
	Product    *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	// Snapshot fields keep the exact catalog/supplier values used when the pre-order was created.
	// They must not change when the WMS product or supplier master data is edited later.
	ProductNameSnapshot string  `gorm:"type:varchar(255);not null;default:''" json:"product_name"`
	ProductCodeSnapshot string  `gorm:"type:varchar(100);not null;default:''" json:"product_code"`
	SupplierPartCode    string  `gorm:"type:varchar(100);not null;default:''" json:"supplier_part_code"`
	SupplierName        string  `gorm:"type:varchar(255);not null;default:''" json:"supplier_name"`
	Quantity            int     `gorm:"not null" json:"quantity"`
	UnitPrice           float64 `gorm:"not null" json:"unit_price"`
	Status              string  `gorm:"not null;default:'PENDING'" json:"status"`
}
