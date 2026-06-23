package entity

import "gorm.io/gorm"

type Customer struct {
    gorm.Model
    // User ส่งมา
    CustomerName string  `gorm:"type:varchar(100);not null" json:"customer_name" binding:"required"`
    CustomerType string  `gorm:"type:varchar(50);not null" json:"customer_type" binding:"required"`
    CreditLimit  float64 `gorm:"type:decimal(15,2);not null" json:"credit_limit" binding:"required"`

    // Optional
    Address              string `gorm:"type:varchar(255)" json:"address"`
    Phone                string `gorm:"type:varchar(20)" json:"phone"`
    IdCardNumberCustomer string `gorm:"type:varchar(20)" json:"id_card_number_customer"`
    IdCardImagePath      string `gorm:"type:varchar(255)" json:"id_card_image_path"`
    RegisteredAddress    string `gorm:"type:varchar(255)" json:"registered_address"`

    // ระบบ Set เอง
    CurrentBalance       float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"current_balance"`
    StandardDiscountRate float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"standard_discount_rate"`
    CurrentDebtAmount    float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"current_debt_amount"`
    IsDiscountEnabled    bool    `gorm:"type:boolean;not null;default:true" json:"is_discount_enabled"`
}
