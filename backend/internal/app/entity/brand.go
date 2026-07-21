package entity

import "gorm.io/gorm"

type Brand struct {
	gorm.Model
	Brand_Name string `json:"brand_name"`

	Models []Models `gorm:"foreignKey:BrandID" json:"models"`

	Products []Product `gorm:"many2many:product_brands;" json:"products"`
}