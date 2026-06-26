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
		var result entity.Category
		err := db.Where("category_name = ?", category.Category_Name).
			FirstOrCreate(&result, category).Error
		if err == nil {
			db.Model(&result).Updates(category)
		}
		if err != nil {
			return fmt.Errorf("failed to seed category %s: %w", category.Category_Name, err)
		}
	}
	return nil
}