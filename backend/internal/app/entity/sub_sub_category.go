package entity

import "gorm.io/gorm"

type SubSubCategory struct {
	gorm.Model
	Sub_Sub_Category_Name string `json:"sub_sub_category_name"`
	Sub_Sub_Category_Short_Name string `json:"sub_sub_category_short_name"`
	Description string `json:"description"`

	SubCategoryID *uint `json:"sub_category_id"`

	SubCategory *SubCategory `gorm:"foreignKey:SubCategoryID" json:"sub_category"`

}