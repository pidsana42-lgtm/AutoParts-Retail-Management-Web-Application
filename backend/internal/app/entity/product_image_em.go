package entity

import "gorm.io/gorm"

type ProductImageEm struct {
	gorm.Model
	ImageEm_URL string `json:"imageem_url"`

	ProductImageID uint `json:"product_image_id"`

	ProductImage *ProductImage `gorm:"foreignKey:ProductImageID" json:"product_image"`
}