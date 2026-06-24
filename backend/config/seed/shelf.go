package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Shelf(db *gorm.DB) error {
	shelves := []entity.Shelf{
		{Shelf_Name: "A1",ZoneID: 1},
		
	}

	for _, shelf := range shelves {
		if err := db.Create(&shelf).Error; err != nil {
			return fmt.Errorf("failed to create shelf: %w", err)
		}
	}
	return nil
}