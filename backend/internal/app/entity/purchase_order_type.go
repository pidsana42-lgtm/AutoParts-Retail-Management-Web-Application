package entity

import "gorm.io/gorm"

type POType struct {
	gorm.Model
	PO_type_name	string 		`gorm:"type:varchar(100);uniqueIndex;not null" json:"po_type_name"`
	PO 				[]PO 		`gorm:"foreignKey:PO_type_id" json:"purchase_orders,omitempty"`
}

func (POType) TableName() string {
	return "purchase_order_type"
}