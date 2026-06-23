package entity

import (
	"backend/internal/app/enum"
	"gorm.io/gorm"
	"time"
)

type SaleOrder struct {
    gorm.Model
    // User ส่งมา
    OrderNumber string    `gorm:"type:varchar(100);not null;unique" json:"order_number" binding:"required"`
    OrderDate   time.Time `gorm:"type:date;not null" json:"order_date" binding:"required"`

    // FK
    CustomerID uint     `gorm:"not null" json:"customer_id" binding:"required"`
    Customer   Customer `gorm:"foreignKey:CustomerID" json:"customer"`

    // Optional
    CustomerNameTemp  *string `gorm:"type:varchar(100)" json:"customer_name_temp"`
    CustomerPhoneTemp *string `gorm:"type:varchar(20)" json:"customer_phone_temp"`

    // ระบบ Set เอง 
    Status        enum.OrderStatus   `gorm:"type:varchar(50);not null;default:pending" json:"status"`
    PaymentStatus enum.PaymentStatus `gorm:"type:varchar(50);not null;default:unpaid" json:"payment_status"`

    // ระบบคำนวณเอง
    Subtotal        float64 `gorm:"type:decimal(15,2);not null" json:"subtotal"`
    DiscountAmount  float64 `gorm:"type:decimal(15,2);not null" json:"discount_amount"`
    DiscountPercent float64 `gorm:"type:decimal(15,2);not null" json:"discount_percent"`
    TotalAmount     float64 `gorm:"type:decimal(15,2);not null" json:"total_amount"`
    PaidAmount      float64 `gorm:"type:decimal(15,2);not null" json:"paid_amount"`
    BalanceDue      float64 `gorm:"type:decimal(15,2);not null" json:"balance_due"`
    ChangeAmount    float64 `gorm:"type:decimal(15,2);not null" json:"change_amount"`

    // Optional
    DueDate  *time.Time `gorm:"type:date" json:"due_date"`
    PaidDate *time.Time `gorm:"type:date" json:"paid_date"`
    Note     string     `gorm:"type:varchar(255)" json:"note"`

	// ความสัมพันธ์ 1 Order มีได้หลายอัน
    Items    []SaleOrderItem `gorm:"foreignKey:OrderID" json:"items"`
    Payments []Payment       `gorm:"foreignKey:OrderID" json:"payments"`

    // Toto WMS
    StockMovements []StockMovement `gorm:"foreignKey:SaleOrderID" json:"stock_movements"`
}