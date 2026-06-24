package entity

import "gorm.io/gorm"

// เพิ่ม ตาราง CustomerType เพื่อเก็บประเภทของลูกค้า เช่น "GENERAL", "PARTNER" และส่วนลดตั้งต้นของกลุ่มลูกค้านั้น ๆ
type CustomerType struct {
	gorm.Model
	TypeName  string `gorm:"type:varchar(50);not null;unique"` // เช่น "GENERAL", "PARTNER"
	TypeLabel string `gorm:"type:varchar(100);not null"`       // ชื่อแสดงผลภาษาไทย เช่น "สมาชิกทั่วไป", "อู่ซ่อมรถพันธมิตร"
}

type Customer struct {
	gorm.Model
	// User ส่งมา
	CustomerName string `gorm:"type:varchar(100);not null" json:"customer_name" binding:"required"`

	CustomerTypeID uint         `json:"customer_type_id"`
	CustomerType   CustomerType `gorm:"foreignKey:CustomerTypeID" json:"customer_type"`

	CreditLimit float64 `gorm:"type:decimal(15,2);not null" json:"credit_limit" binding:"required"`

	// Optional
	PhoneNumber          string `gorm:"type:varchar(20);unique" json:"phone_number"`
	IdCardNumberCustomer string `gorm:"type:varchar(20);unique" json:"id_card_number_customer"`
	IdCardImagePath      string `gorm:"type:varchar(255)" json:"id_card_image_path"`
	RegisteredAddress    string `gorm:"type:varchar(255)" json:"registered_address"` // ที่อยู่ทะเบียนบ้าน
	ShippingAddress      string `gorm:"type:varchar(255)" json:"shipping_address"`   // ที่อยู่จัดส่ง/ที่ตั้งอู่

	// ระบบ Set เอง
	CurrentBalance       float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"current_balance"`
	StandardDiscountRate float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"standard_discount_rate"`
	CurrentDebtAmount    float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"current_debt_amount"`
	IsDiscountEnabled    bool    `gorm:"type:boolean;not null;default:true" json:"is_discount_enabled"`
}
