package seed

import (
	"backend/internal/app/enum"
	"backend/internal/app/entity"
	"fmt"

	"gorm.io/gorm"
)

func Role(db *gorm.DB) error {
	roles := []entity.Role{
		{RoleName: enum.RoleOwner},
		{RoleName: enum.RoleEmployee},
		{RoleName: enum.RoleAdmin},
	}

	for _, r := range roles {
		var result entity.Role

		err := db.Where("role_name = ?", r.RoleName).
			FirstOrCreate(&result, entity.Role{RoleName: r.RoleName}).
			Error

		if err != nil {
			return fmt.Errorf("failed to seed role %s: %w", r.RoleName, err)
		}
	}

	return nil
}