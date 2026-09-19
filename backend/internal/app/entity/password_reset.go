package entity

import (
	"time"

	"gorm.io/gorm"
)

type PasswordReset struct {
	gorm.Model
	UserID    uint      `gorm:"index" json:"user_id"`
	Email     string    `gorm:"type:varchar(100);index" json:"email"`
	OTP       string    `gorm:"type:varchar(10);index" json:"otp"`
	ExpiresAt time.Time `json:"expires_at"`
	IsUsed    bool      `gorm:"default:false" json:"is_used"`
}
