package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Grade(db *gorm.DB) error {
	grades := []entity.Grade{
		{Grade_Name: "A"},
		{Grade_Name: "B"},
		{Grade_Name: "C"},
	}

	for _, grade := range grades {
		if err := db.Create(&grade).Error; err != nil {
			return fmt.Errorf("failed to create grade: %w", err)
		}
	}
	return nil
}