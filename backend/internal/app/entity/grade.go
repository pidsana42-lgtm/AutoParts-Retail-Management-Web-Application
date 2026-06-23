package entity

import "gorm.io/gorm"

type Grade struct {
	gorm.Model
	Grade_Name string `json:"grade_name"`

	Products []Product `gorm:"foreignKey:GradeID" json:"products"`
}