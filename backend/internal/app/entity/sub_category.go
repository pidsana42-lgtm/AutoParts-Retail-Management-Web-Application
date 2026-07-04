package entity

import "gorm.io/gorm"

type SubCategory struct {
	gorm.Model
	Sub_Category_Name string `json:"sub_category_name"`
	Sub_Category_Short_Name string `json:"sub_category_short_name"`
	Description string `json:"description"`

	CategoryID *uint `json:"category_id"`

	Category *Category `gorm:"foreignKey:CategoryID" json:"category"`

}