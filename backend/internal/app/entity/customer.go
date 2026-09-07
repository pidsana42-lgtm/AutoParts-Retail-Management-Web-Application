package entity

import (
	"backend/internal/pkg/crypto"
	"gorm.io/gorm"
)

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
	IdCardNumberCustomer string `gorm:"type:varchar(255);unique" json:"id_card_number_customer"`
	IdCardImagePath      string `gorm:"type:varchar(255)" json:"id_card_image_path"`
	RegisteredAddress    string `gorm:"type:varchar(255)" json:"registered_address"` // ที่อยู่ทะเบียนบ้าน
	ShippingAddress      string `gorm:"type:varchar(255)" json:"shipping_address"`   // ที่อยู่จัดส่ง/ที่ตั้งอู่

	// ระบบ Set เอง
	CurrentBalance       float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"current_balance"` // ยอดคงเหลือของลูกค้า (เช่น 1000.00 หมายถึงค้างชำระ 1,000 บาท)
	StandardDiscountRate float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"standard_discount_rate"` // เปอร์เซ็นต์ส่วนลดมาตรฐานของอู่ (เช่น 5.00 หมายถึง 5%)	
	CurrentDebtAmount    float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"current_debt_amount"` // ยอดหนี้คงค้างของอู่ (เช่น 1000.00 หมายถึงค้างชำระ 1,000 บาท)
	// เปิด-ปิดการให้ส่วนลดพิเศษของอู่นี้ (ถ้าเครดิตไม่ดีก็สั่งเป็น false)
	IsDiscountEnabled bool `gorm:"type:boolean;not null;default:true" json:"is_discount_enabled"`
	
	// เปลี่ยนมาใช้ฟิลด์นี้เก็บ "เปอร์เซ็นต์ส่วนลดที่จะเอาไปบวกเพิ่มให้ทุกชิ้น"
	// เช่น อู่เครดิตดีมาก ใส่ตรงนี้เป็น 3.00 (%) พอไปดึงของเพื่อนมา มันจะเอาไป +3% อัตโนมัติ
	OntopDiscountRate float64 `gorm:"type:decimal(5,2);not null;default:0.00" json:"ontop_discount_rate"`
}

func (c *Customer) BeforeSave(tx *gorm.DB) error {
	if c.IdCardNumberCustomer != "" && !crypto.IsEncrypted(c.IdCardNumberCustomer) {
		encrypted, err := crypto.EncryptAES256(c.IdCardNumberCustomer)
		if err != nil {
			return err
		}
		c.IdCardNumberCustomer = encrypted
	}
	return nil
}

func (c *Customer) AfterSave(tx *gorm.DB) error {
	if c.IdCardNumberCustomer != "" && crypto.IsEncrypted(c.IdCardNumberCustomer) {
		decrypted, err := crypto.DecryptAES256(c.IdCardNumberCustomer)
		if err == nil {
			c.IdCardNumberCustomer = decrypted
		}
	}
	return nil
}

func (c *Customer) AfterFind(tx *gorm.DB) error {
	if c.IdCardNumberCustomer != "" && crypto.IsEncrypted(c.IdCardNumberCustomer) {
		decrypted, err := crypto.DecryptAES256(c.IdCardNumberCustomer)
		if err == nil {
			c.IdCardNumberCustomer = decrypted
		}
	}
	return nil
}

type CustomerCreditAuditLog struct {
	gorm.Model
	CustomerID   *uint  `json:"customer_id"`
	CustomerName string `gorm:"type:varchar(100);not null" json:"customer_name"`
	Action       string `gorm:"type:varchar(255);not null" json:"action"`
	Details      string `gorm:"type:text;not null" json:"details"`
	ChangedBy    string `gorm:"type:varchar(100);not null" json:"changed_by"`
	UserID       *uint  `json:"user_id"`
	User         *User  `gorm:"foreignKey:UserID" json:"user,omitempty"`
}
