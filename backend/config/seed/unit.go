package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Unit(db *gorm.DB) error {
	units := []entity.Unit{
		{Unit_Name: "Piece"},
		{Unit_Name: "Box"},
		{Unit_Name: "Pack"},
	}

	for _, unit := range units {
		if err := db.Create(&unit).Error; err != nil {
			return fmt.Errorf("failed to create unit: %w", err)
		}
	}
	return nil
}