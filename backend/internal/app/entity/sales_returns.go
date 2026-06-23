package entity

import (
	"time"

	"gorm.io/gorm"
)

type SalesReturn struct {
	gorm.Model
	ReturnNumber    string     `gorm:"unique;not null;index" json:"return_number"`
	OriginalOrderID uint       `gorm:"not null;index" json:"original_order_id"`
	OriginalOrder   *Bill      `gorm:"foreignKey:OriginalOrderID" json:"original_order,omitempty"`
	ReturnDate      time.Time  `gorm:"not null" json:"return_date"`
	Reason          string     `gorm:"not null" json:"reason"`
	RefundAmount    float64    `gorm:"type:decimal(15,2);not null" json:"refund_amount"`
	RefundMethod    string     `gorm:"not null" json:"refund_method"`
	RequestedAt     time.Time  `gorm:"not null" json:"requested_at"`
	ApprovedAt      *time.Time `json:"approved_at"`
	Note            string     `gorm:"type:text" json:"note"`
	CreatedBy       uint       `gorm:"not null;index" json:"created_by"`
	CreatedByUser   *User      `gorm:"foreignKey:CreatedBy" json:"created_by_user,omitempty"`
	ApprovedBy      *uint      `gorm:"index" json:"approved_by"`
	ApprovedByUser  *User      `gorm:"foreignKey:ApprovedBy" json:"approved_by_user,omitempty"`
}
