package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Category(db *gorm.DB) error {
	categories := []entity.Category{
		{Category_Name: "Engine Parts"},

	}

	for _, category := range categories {
		if err := db.Create(&category).Error; err != nil {
			return fmt.Errorf("failed to create category: %w", err)
		}
	}
	return nil
}