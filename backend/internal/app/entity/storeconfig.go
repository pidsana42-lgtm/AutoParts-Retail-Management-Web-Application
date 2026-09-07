package entity

import "gorm.io/gorm"

type StoreConfig struct {
	gorm.Model

	// นโยบายเครดิต
	MaxCredit      float64 `gorm:"type:decimal(15,2);not null" json:"max_credit" binding:"required"`
	MaxOverdueDays int     `gorm:"type:integer;not null" json:"max_overdue_days" binding:"required"`

	// นโยบายการเงิน/ส่วนลด
	//MaxItemDiscountRate  float64 `gorm:"type:decimal(15,2);not null" json:"max_item_discount_rate" binding:"required"`
	MaxExtraDiscountRate float64 `gorm:"type:decimal(15,2);not null" json:"max_extra_discount_rate" binding:"required"`

	// ระบบความปลอดภัย
	SupervisedPin string `gorm:"type:varchar(10);not null" json:"supervised_pin" binding:"required"`
}

type StoreConfigAuditLog struct {
	gorm.Model
	Action    string `gorm:"type:varchar(255);not null" json:"action"`
	Details   string `gorm:"type:text;not null" json:"details"`
	ChangedBy string `gorm:"type:varchar(100);not null" json:"changed_by"`
	UserID    *uint  `json:"user_id"`
	User      *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
