package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func SubCategory(db *gorm.DB) error {
	// helper function to get category ID by name
	getCatID := func(name string) *uint {
		var cat entity.Category
		if err := db.Where("category_name = ?", name).First(&cat).Error; err == nil {
			id := cat.ID
			return &id
		}
		return nil
	}

	// We'll define the sub-categories list with their target category names.
	subCatsToSeed := []struct {
		SubName   string
		ShortName string
		Desc      string
		CatName   string
	}{
		// Engine Parts
		{"Filters", "FLT", "Engine Oil, Fuel, and Air Filters", "Engine Parts"},
		{"Gaskets", "GSK", "Engine Cylinder Head Gaskets & Seals", "Engine Parts"},
		{"Belts", "BLT", "Timing Belts and Drive Belts", "Engine Parts"},
		
		// Cooling System
		{"Radiators", "RAD", "Engine Radiators and coolant reservoirs", "Cooling System"},
		{"Water Pumps", "WPM", "Water pumps and cooling fans", "Cooling System"},
		
		// Steering & Suspension
		{"Steering Linkages", "STG", "Tie rod ends, drag links, steering arms", "Steering & Suspension"},
		{"Linkage Chains", "CHN", "Chains, U-links, and shackle linkages", "Steering & Suspension"},
		{"Center Links", "CLK", "Center arms, linkage rods, and drawbars", "Steering & Suspension"},
		
		// Electrical & Lighting
		{"LED Lights", "LED", "Work lights, LED bars, spot lights", "Electrical & Lighting"},
		{"Switches", "SWT", "Ignition, relay, and toggle switches", "Electrical & Lighting"},
		
		// Fuel & Air
		{"Fuel Caps", "FCP", "Diesel/Fuel tank caps and filler necks", "Fuel & Air"},
		{"Fuel Pumps", "FPM", "Fuel lift pumps and injection assemblies", "Fuel & Air"},
		
		// Transmission & Clutch
		{"Oil Seals", "OSL", "Shaft seals, gearbox seals, gear lip seals", "Transmission & Clutch"},
		{"Gear Springs", "GSP", "Shifter springs, return springs, detent springs", "Transmission & Clutch"},
	}

	for _, sub := range subCatsToSeed {
		catID := getCatID(sub.CatName)
		if catID == nil {
			fmt.Printf("[Seed Warning] Category '%s' not found, skipping sub-category '%s'\n", sub.CatName, sub.SubName)
			continue
		}

		dbSub := entity.SubCategory{
			Sub_Category_Name:       sub.SubName,
			Sub_Category_Short_Name: sub.ShortName,
			Description:             sub.Desc,
			CategoryID:              catID,
		}

		var result entity.SubCategory
		err := db.Where("sub_category_name = ? AND category_id = ?", dbSub.Sub_Category_Name, dbSub.CategoryID).
			FirstOrCreate(&result, dbSub).Error
		if err == nil {
			db.Model(&result).Updates(dbSub)
		}
		if err != nil {
			return fmt.Errorf("failed to seed subcategory %s: %w", dbSub.Sub_Category_Name, err)
		}
	}
	return nil
}
