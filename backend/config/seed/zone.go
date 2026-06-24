package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Zone(db *gorm.DB) error {
	zones := []entity.Zone{
		{Zone_Name: "Zone A"},
	}

	for _, zone := range zones {
		if err := db.Create(&zone).Error; err != nil {
			return fmt.Errorf("failed to create zone: %w", err)
		}
		
	}
	return nil
}