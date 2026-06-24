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
		var result entity.Shelf
		err := db.Where("shelf_name = ? AND zone_id = ?", shelf.Shelf_Name, shelf.ZoneID).
			FirstOrCreate(&result, shelf).Error
		if err == nil {
			db.Model(&result).Updates(shelf)
		}
		if err != nil {
			return fmt.Errorf("failed to seed shelf %s: %w", shelf.Shelf_Name, err)
		}
	}
	return nil
}