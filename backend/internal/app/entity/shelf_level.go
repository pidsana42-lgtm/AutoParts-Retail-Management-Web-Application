package entity

import "gorm.io/gorm"

type ShelfLevel struct {
	gorm.Model
	Level_Name string `json:"level_name"`
	ShelfID    uint   `json:"shelf_id"`

	Shelf    *Shelf    `gorm:"foreignKey:ShelfID" json:"shelf"`
	Products []Product `gorm:"foreignKey:ShelfLevelID" json:"products"`
}
