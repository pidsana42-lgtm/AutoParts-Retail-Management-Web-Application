package entity

import "gorm.io/gorm"

type Bank struct {
	gorm.Model
	BankName string `gorm:"type:varchar(100);not null;unique" json:"bank_name" binding:"required"`
}