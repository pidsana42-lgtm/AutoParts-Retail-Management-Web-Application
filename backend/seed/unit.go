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
		var result entity.Unit
		err := db.Where("unit_name = ?", unit.Unit_Name).
			FirstOrCreate(&result, unit).Error
		if err == nil {
			db.Model(&result).Updates(unit)
		}
		if err != nil {
			return fmt.Errorf("failed to seed unit %s: %w", unit.Unit_Name, err)
		}
	}
	return nil
}