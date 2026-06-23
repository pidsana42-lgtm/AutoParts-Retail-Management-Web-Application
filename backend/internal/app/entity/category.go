package entity

import "gorm.io/gorm"

type Category struct {
	gorm.Model
	Category_Name string `json:"category_name"`
	Category_Short_Name string `json:"category_short_name"`
	Description string `json:"description"`

	Products []Product `gorm:"foreignKey:CategoryID" json:"products"`
	SubCategories []SubCategory `gorm:"foreignKey:CategoryID" json:"sub_categories"`
}