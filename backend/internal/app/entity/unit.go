package entity

import "gorm.io/gorm"

type Unit struct {
	gorm.Model
	Unit_Name string `json:"unit_name"`
	Products []Product `gorm:"foreignKey:UnitID" json:"products"`
}