package entity

import "gorm.io/gorm"

type StoreConfig struct {
    gorm.Model
    MaxCredit            float64 `gorm:"type:decimal(15,2);not null" json:"max_credit" binding:"required"`
    SupervisedPin        string  `gorm:"type:varchar(10);not null" json:"supervised_pin" binding:"required"`
    MaxItemDiscountRate  float64 `gorm:"type:decimal(15,2);not null" json:"max_item_discount_rate" binding:"required"`
    MaxOverdueDays       int     `gorm:"type:int;not null" json:"max_overdue_days" binding:"required"`
    MaxExtraDiscountRate float64 `gorm:"type:decimal(15,2);not null" json:"max_extra_discount_rate" binding:"required"`
}
