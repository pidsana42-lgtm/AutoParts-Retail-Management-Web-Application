package entity

import (
	"time"

	"gorm.io/gorm"
)

type PaymentRepayment struct {
    gorm.Model
    // FK ID User ส่งมา
    OrderID uint      `gorm:"not null" json:"order_id" binding:"required"`
    Order   SaleOrder `gorm:"foreignKey:OrderID" json:"order"`

    PaymentMethodID uint          `gorm:"not null" json:"payment_method_id" binding:"required"`
    PaymentMethod   PaymentMethod `gorm:"foreignKey:PaymentMethodID" json:"payment_method"`

    // User ส่งมา
    AmountPaid float64 `gorm:"type:decimal(15,2);not null" json:"amount_paid" binding:"required"`
    
    // ระบบ Set เอง 
    DiscountGiven float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_given"`

    // Optional
    PaidAt *time.Time `gorm:"type:timestamptz" json:"paid_at"`

    // FK ID User ส่งมา
    RecordedByID uint `gorm:"not null" json:"recorded_by_id" binding:"required"`
    RecordedBy   User `gorm:"foreignKey:RecordedByID" json:"recorded_by"`
}
