package entity

import (
	"time"

	"gorm.io/gorm"
)

type Payment struct {
	gorm.Model

	OrderID uint      `gorm:"not null" json:"order_id" binding:"required"`
	Order   SaleOrder `gorm:"foreignKey:OrderID" json:"order"`

	PaymentMethodID uint          `gorm:"not null" json:"payment_method_id" binding:"required"`
	PaymentMethod   PaymentMethod `gorm:"foreignKey:PaymentMethodID" json:"payment_method"`

	Amount          float64 `gorm:"type:decimal(15,2);not null" json:"amount" binding:"required"`
	ReferenceNumber string  `gorm:"type:varchar(100);" json:"reference_number"`

	PaidAt *time.Time `gorm:"type:timestamp;" json:"paid_at"`

	ReceivedByID uint `gorm:"not null" json:"received_by_id" binding:"required"`
	ReceivedBy   User `gorm:"foreignKey:ReceivedByID" json:"received_by"`

	//ReturnID *uint   `json:"return_id"`
	//Return   *Return `gorm:"foreignKey:ReturnID" json:"return"`
}
