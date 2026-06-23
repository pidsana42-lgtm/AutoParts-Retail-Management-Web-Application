package entity

import "gorm.io/gorm"

type CheckStock struct {
	gorm.Model
	Old_Quantity int `json:"old_quantity"`
	New_Quantity int `json:"new_quantity"`
	Diff_Quantity int `json:"diff_quantity"`
	Reason string `json:"reason"`
	Adjustment_DateTime string `json:"adjustment_datetime"`

	ProductID uint `json:"product_id"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product"`
}