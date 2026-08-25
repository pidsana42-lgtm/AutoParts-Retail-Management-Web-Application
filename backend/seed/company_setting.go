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
			"id":            1,
			"company_name":  "ร้าน เจ.เจ. อะไหล่ยนต์",
			"tax_id_number": "0105565012345",
			"address":       "123 ถนนพหลโยธิน แขวงลาดยาว เขตจตุจักร กรุงเทพฯ 10900",
			"phone_number":  "02-123-4567",
			"email":         "contact@autopart.co.th",
			"logo_url":      "",
		}).
		FirstOrCreate(&result).Error

	if err != nil {
		return fmt.Errorf("failed to seed company setting: %w", err)
	}

	return nil
}
