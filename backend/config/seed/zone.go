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
		var result entity.Zone
		err := db.Where("zone_name = ?", zone.Zone_Name).
			FirstOrCreate(&result, zone).Error
		if err == nil {
			db.Model(&result).Updates(zone)
		}
		if err != nil {
			return fmt.Errorf("failed to seed zone %s: %w", zone.Zone_Name, err)
		}
		
	}
	return nil
}