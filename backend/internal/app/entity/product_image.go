package entity

import (
	"gorm.io/gorm"
)

type ProductImage struct {
	gorm.Model
	Image_URL string `json:"image_url"`

	ProductID uint `json:"product_id"`

	Product *Product `gorm:"foreignKey:ProductID" json:"product"`
	ProductImageems []ProductImageEm `gorm:"foreignKey:ProductImageID" json:"product_imageems"`
}