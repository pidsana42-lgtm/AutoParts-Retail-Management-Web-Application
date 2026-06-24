package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func StoreConfig(db *gorm.DB) error {
	storeConfigs := []entity.StoreConfig{
		{
			MaxCredit:            50000.00,
			MaxOverdueDays:       90,
			MaxItemDiscountRate:  2.00,
			MaxExtraDiscountRate: 2.00,
			SupervisedPin:        "1234", // พินตั้งต้นสำหรับเทส
		},
	}

	for _, c := range storeConfigs {
		var result entity.StoreConfig
		err := db.Where("id = ?", 1).
		FirstOrCreate(&result, &c).Error

	if err != nil {
		return fmt.Errorf("failed to seed store config: %w", err)
	}
	}
	return nil
}