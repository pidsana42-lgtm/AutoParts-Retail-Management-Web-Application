package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func SubCategory(db *gorm.DB) error {
	subCategories := []entity.SubCategory{
		{
			Sub_Category_Name:       "Filters",
			Sub_Category_Short_Name: "FLT",
			Description:             "Engine Oil, Fuel, and Air Filters",
			CategoryID:              1, // Engine Parts
		},
		{
			Sub_Category_Name:       "Gaskets",
			Sub_Category_Short_Name: "GSK",
			Description:             "Engine Cylinder Head Gaskets & Seals",
			CategoryID:              1, // Engine Parts
		},
		{
			Sub_Category_Name:       "Belts",
			Sub_Category_Short_Name: "BLT",
			Description:             "Timing Belts and Drive Belts",
			CategoryID:              1, // Engine Parts
		},
	}

	for _, sub := range subCategories {
		var result entity.SubCategory
		err := db.Where("sub_category_name = ? AND category_id = ?", sub.Sub_Category_Name, sub.CategoryID).
			FirstOrCreate(&result, sub).Error
		if err == nil {
			db.Model(&result).Updates(sub)
		}
		if err != nil {
			return fmt.Errorf("failed to seed subcategory %s: %w", sub.Sub_Category_Name, err)
		}
	}
	return nil
}
