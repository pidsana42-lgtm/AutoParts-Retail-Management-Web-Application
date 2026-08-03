package entity

import "gorm.io/gorm"

type ProductQRCode struct {
	gorm.Model
	ProductID   uint     `json:"product_id"`
	QRCodeData  string   `json:"qr_code_data" gorm:"unique;not null"`
	BatchNo     string   `json:"batch_no"`
	IsActive    bool     `json:"is_active" gorm:"default:true"`
	
	// Relationships
	Product     *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
}
