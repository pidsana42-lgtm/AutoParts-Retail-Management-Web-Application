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
		var result entity.Brand
		 err := db.Where("brand_name = ?", brand.Brand_Name).
            FirstOrCreate(&result, brand).Error
        if err == nil  {
            db.Model(&result).Updates(brand)
        }

        if err != nil {
            return fmt.Errorf("failed to seed brand %s: %w", brand.Brand_Name, err)
        }
    }
	
	return nil
}