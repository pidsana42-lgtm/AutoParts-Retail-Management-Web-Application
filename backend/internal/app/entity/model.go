package entity

import "gorm.io/gorm"

type Models struct {
	gorm.Model
	Model_Name string `json:"model_name"`
	BrandID uint `json:"brand_id"`

	Brand *Brand `gorm:"foreignKey:BrandID" json:"brands"`

}