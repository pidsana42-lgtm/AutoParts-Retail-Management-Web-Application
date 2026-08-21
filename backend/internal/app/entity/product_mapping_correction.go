package entity

import "time"

type ProductMappingCorrection struct {
	ID              uint      `gorm:"primaryKey;autoIncrement" json:"id"`
	SupplierID      uint      `gorm:"not null;default:1;uniqueIndex:uq_supplier_ai_name_code" json:"supplier_id"`
	AIProductName   string    `gorm:"column:ai_product_name;size:255;not null;uniqueIndex:uq_supplier_ai_name_code" json:"ai_product_name"`
	AIProductCode   string    `gorm:"column:ai_product_code;size:255;not null;default:'';uniqueIndex:uq_supplier_ai_name_code" json:"ai_product_code"`
	UserProductName string    `gorm:"size:255;not null" json:"user_product_name"`
	UserProductCode string    `gorm:"size:255;not null;default:''" json:"user_product_code"`
	ProductID       uint      `gorm:"not null;index" json:"product_id"`
	Product         *Product  `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (ProductMappingCorrection) TableName() string {
	return "product_mapping_corrections"
}
