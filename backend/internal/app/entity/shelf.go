package entity

import "gorm.io/gorm"

type Shelf struct {
	gorm.Model
	Shelf_Name string `json:"shelf_name"`
	ZoneID uint `json:"zone_id"`

	Zone *Zone `gorm:"foreignKey:ZoneID" json:"zone"`

	ShelfLevels []ShelfLevel `gorm:"foreignKey:ShelfID" json:"shelf_levels"`
	Products    []Product    `gorm:"foreignKey:ShelfID" json:"products"`
}