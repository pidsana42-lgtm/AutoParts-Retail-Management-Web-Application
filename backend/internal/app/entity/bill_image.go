package entity

import "gorm.io/gorm"

type BillImage struct {
	gorm.Model
	BillID uint   `gorm:"not null;index" json:"bill_id"`
	Bill   *Bill  `gorm:"foreignKey:BillID" json:"bill,omitempty"`
	Image  string `gorm:"not null" json:"image"`
}
