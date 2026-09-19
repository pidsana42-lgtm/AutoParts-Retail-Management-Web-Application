package entity

import (
	"backend/internal/pkg/crypto"

	"gorm.io/gorm"
)

type CompanySetting struct {
	gorm.Model
	CompanyName       string `gorm:"type:varchar(255);not null" json:"company_name"`
	TaxIDNumber       string `gorm:"type:varchar(255);not null" json:"tax_id_number"`
	Address           string `gorm:"type:text;not null" json:"address"`
	PhoneNumber       string `gorm:"type:varchar(50);not null" json:"phone_number"`
	Email             string `gorm:"type:varchar(100);not null" json:"email"`
	LogoURL           string `gorm:"type:text;not null" json:"logo_url"`

	// การตั้งค่าข้อมูลพร้อมเพย์ (PromptPay Settings) สำหรับสร้าง QR Code ในระบบ POS
	PromptPayType   string `gorm:"type:varchar(50);default:'phone'" json:"promptpay_type"` // phone, tax_id
	PromptPayNumber string `gorm:"type:varchar(255)" json:"promptpay_number"`             // จัดเก็บแบบเข้ารหัส AES-256
	PromptPayName   string `gorm:"type:varchar(255)" json:"promptpay_name"`

	// ข้อมูลบัญชีธนาคาร (Bank Account Details) สำหรับแสดงประกอบใต้ QR Code และในใบเสร็จ
	BankName          string `gorm:"type:varchar(100)" json:"bank_name"`
	BankAccountNumber string `gorm:"type:varchar(255)" json:"bank_account_number"` // จัดเก็บแบบเข้ารหัส AES-256
	BankAccountName   string `gorm:"type:varchar(255)" json:"bank_account_name"`
}

func (CompanySetting) TableName() string {
	return "company_setting"
}

func (c *CompanySetting) BeforeSave(tx *gorm.DB) error {
	if c.PromptPayNumber != "" && !crypto.IsEncrypted(c.PromptPayNumber) {
		encrypted, err := crypto.EncryptAES256(c.PromptPayNumber)
		if err != nil {
			return err
		}
		c.PromptPayNumber = encrypted
	}
	if c.BankAccountNumber != "" && !crypto.IsEncrypted(c.BankAccountNumber) {
		encrypted, err := crypto.EncryptAES256(c.BankAccountNumber)
		if err != nil {
			return err
		}
		c.BankAccountNumber = encrypted
	}
	return nil
}

func (c *CompanySetting) AfterSave(tx *gorm.DB) error {
	if c.PromptPayNumber != "" && crypto.IsEncrypted(c.PromptPayNumber) {
		decrypted, err := crypto.DecryptAES256(c.PromptPayNumber)
		if err == nil {
			c.PromptPayNumber = decrypted
		}
	}
	if c.BankAccountNumber != "" && crypto.IsEncrypted(c.BankAccountNumber) {
		decrypted, err := crypto.DecryptAES256(c.BankAccountNumber)
		if err == nil {
			c.BankAccountNumber = decrypted
		}
	}
	return nil
}

func (c *CompanySetting) AfterFind(tx *gorm.DB) error {
	if c.PromptPayNumber != "" && crypto.IsEncrypted(c.PromptPayNumber) {
		decrypted, err := crypto.DecryptAES256(c.PromptPayNumber)
		if err == nil {
			c.PromptPayNumber = decrypted
		}
	}
	if c.BankAccountNumber != "" && crypto.IsEncrypted(c.BankAccountNumber) {
		decrypted, err := crypto.DecryptAES256(c.BankAccountNumber)
		if err == nil {
			c.BankAccountNumber = decrypted
		}
	}
	return nil
}