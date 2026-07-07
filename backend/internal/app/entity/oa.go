package entity

import "gorm.io/gorm"

type LineUser struct {
	gorm.Model
	LineUserID    string    `gorm:"type:varchar(100);not null;uniqueIndex" json:"line_user_id"`
	DisplayName   string    `gorm:"type:varchar(100)" json:"display_name"`
	PictureURL    string    `gorm:"type:text" json:"picture_url"`
	StatusMessage string    `gorm:"type:text" json:"status_message"`
	Language      string    `gorm:"type:varchar(10)" json:"language"`
	CustomerID    *uint     `json:"customer_id"`
	Customer      *Customer `gorm:"foreignKey:CustomerID" json:"customer"`
}

type LineMessage struct {
	gorm.Model
	LineUserID     string `gorm:"type:varchar(100);not null;index" json:"line_user_id"`
	Sender         string `gorm:"type:varchar(20);not null" json:"sender"`         // "user" (LINE user) or "admin" (shop console)
	MessageType    string `gorm:"type:varchar(20);not null" json:"message_type"`   // "text", "image", etc.
	MessageContent string `gorm:"type:text;not null" json:"message_content"`
	IsRead         bool   `gorm:"type:boolean;not null;default:false" json:"is_read"`
}
