package entity

import "gorm.io/gorm"

type Zone struct {
	gorm.Model
	Zone_Name string `json:"zone_name"`

	Shelves []Shelf `gorm:"foreignKey:ZoneID" json:"shelves"`
}