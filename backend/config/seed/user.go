package seed

import (
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"fmt"

	"gorm.io/gorm"
)

func User(db *gorm.DB) error {
	// 1. Seed Bank
	bank := entity.Bank{BankName: "Kasikorn Bank"}
	if err := db.Where("bank_name = ?", bank.BankName).FirstOrCreate(&bank).Error; err != nil {
		return fmt.Errorf("failed to seed bank: %w", err)
	}

	// 2. Seed StoreConfig
	storeConfig := entity.StoreConfig{
		MaxCredit:            100000,
		SupervisedPin:        "1234",
		MaxItemDiscountRate:  10.0,
		MaxOverdueDays:       30,
		MaxExtraDiscountRate: 5.0,
	}
	// Check if any StoreConfig exists
	var count int64
	if err := db.Model(&entity.StoreConfig{}).Count(&count).Error; err != nil {
		return fmt.Errorf("failed to count store configs: %w", err)
	}
	if count == 0 {
		if err := db.Create(&storeConfig).Error; err != nil {
			return fmt.Errorf("failed to seed store config: %w", err)
		}
	} else {
		if err := db.First(&storeConfig).Error; err != nil {
			return fmt.Errorf("failed to fetch store config: %w", err)
		}
	}

	// 3. Fetch Role
	var role entity.Role
	if err := db.Where("role_name = ?", enum.RoleOwner).First(&role).Error; err != nil {
		// If RoleOwner doesn't exist, seed roles first
		if errSeed := Role(db); errSeed != nil {
			return fmt.Errorf("failed to seed roles from user seed: %w", errSeed)
		}
		if err := db.Where("role_name = ?", enum.RoleOwner).First(&role).Error; err != nil {
			return fmt.Errorf("failed to fetch role after seeding: %w", err)
		}
	}

	// 4. Seed Default User with ID 1
	var userCount int64
	if err := db.Model(&entity.User{}).Count(&userCount).Error; err != nil {
		return fmt.Errorf("failed to count users: %w", err)
	}
	if userCount == 0 {
		defaultUser := entity.User{
			FirstName:        "Admin",
			LastName:         "System",
			IdCardNumberUser: "1100000000000",
			Username:         "admin",
			Password:         "adminpassword", // Note: in real production we would hash this, but for simple testing/seeding it is fine
			StoreConfigID:    storeConfig.ID,
			BankID:           bank.ID,
			BankAccountNumber: "123-4-56789-0",
			RoleID:           role.ID,
		}
		// Force ID = 1
		defaultUser.ID = 1
		if err := db.Create(&defaultUser).Error; err != nil {
			return fmt.Errorf("failed to seed default user: %w", err)
		}
	}

	return nil
}
