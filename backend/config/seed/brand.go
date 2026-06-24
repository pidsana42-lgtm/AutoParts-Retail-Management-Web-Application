package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Brand(db *gorm.DB) error {
	brands := []entity.Brand{
		{Brand_Name: "Toyota"},
	}
	
	for _, brand := range brands {
		if err := db.Create(&brand).Error; err != nil {
			return fmt.Errorf("failed to create brand: %w", err)
		}
	}
	return nil
}