package entity

import "gorm.io/gorm"

type BillImage struct {
	gorm.Model
	ImageURL string `gorm:"not null" json:"image_url"`
}
