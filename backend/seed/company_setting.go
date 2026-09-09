package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func CompanySetting(db *gorm.DB) error {
	var result entity.CompanySetting
	err := db.Where("id = ?", 1).
		Attrs(map[string]interface{}{
			"id":                  1,
			"company_name":        "ร้าน เจ.เจ. อะไหล่ยนต์",
			"tax_id_number":       "0105565012345",
			"address":             "123 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900",
			"phone_number":        "02-123-4567",
			"email":               "contact@autopart.co.th",
			"logo_url":            "",
			"promptpay_type":   "phone",
			"promptpay_number": "0812345678",
			"promptpay_name":   "เจเจ อะไหล่ยนต์",
			"bank_name":           "ธนาคารกสิกรไทย (KBANK)",
			"bank_account_number": "0123456789",
			"bank_account_name":   "ร้าน เจ.เจ. อะไหล่ยนต์",
		}).
		FirstOrCreate(&result).Error

	if err != nil {
		return fmt.Errorf("failed to seed company setting: %w", err)
	}

	shouldSave := false
	if result.PromptPayNumber == "" {
		result.PromptPayType = "phone"
		result.PromptPayNumber = "0812345678"
		result.PromptPayName = "เจเจ อะไหล่ยนต์"
		shouldSave = true
	}
	if result.BankAccountNumber == "" {
		result.BankName = "ธนาคารกสิกรไทย (KBANK)"
		result.BankAccountNumber = "0123456789"
		result.BankAccountName = "ร้าน เจ.เจ. อะไหล่ยนต์"
		shouldSave = true
	}
	if shouldSave {
		db.Save(&result)
	}

	return nil
}
