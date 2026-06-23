package entity

import "gorm.io/gorm"

type PO_Type struct {
	gorm.Model
	PO_type_name	string 		`gorm:"type:varchar(100);uniqueIndex;not null" json:"po_type_name"`
}

func (PO_Type) TableName() string {
	return "purchase_order_type"
}