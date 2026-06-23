package entity

import (
	"backend/internal/app/enum"
	"gorm.io/gorm"
)

type Role struct {
    gorm.Model
    RoleName enum.RoleType `gorm:"type:varchar(100);not null;unique" json:"role_name" binding:"required"`
}