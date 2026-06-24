package entity

import "gorm.io/gorm"

type StoreConfig struct {
	gorm.Model

	// นโยบายเครดิต
	MaxCredit      float64 `gorm:"type:decimal(15,2);not null" json:"max_credit" binding:"required"`
	MaxOverdueDays int     `gorm:"type:integer;not null" json:"max_overdue_days" binding:"required"`

	// นโยบายการเงิน/ส่วนลด
	MaxItemDiscountRate  float64 `gorm:"type:decimal(15,2);not null" json:"max_item_discount_rate" binding:"required"`
	MaxExtraDiscountRate float64 `gorm:"type:decimal(15,2);not null" json:"max_extra_discount_rate" binding:"required"`

	// ระบบความปลอดภัย
	SupervisedPin string `gorm:"type:varchar(10);not null" json:"supervised_pin" binding:"required"`
}
