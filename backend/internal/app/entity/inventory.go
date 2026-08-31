package entity

import (
	"gorm.io/gorm"
	"time"
)

type Inventory struct {
	gorm.Model
	Inventory_Quantity int `json:"inventory_quantity"`
	Last_Updated_DateTime time.Time `json:"last_updated_datetime"`

	ProductID uint `json:"product_id"`
	Product *Product `gorm:"foreignKey:ProductID" json:"product"`

	SupplierID uint `json:"supplier_id"`
	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier"`

	// CompanyProductCode: รหัสสินค้าตามที่ Supplier เจ้านี้ใช้เรียกสินค้าชิ้นนี้ (ย้ายมาจาก entity.Product เดิม)
	// อยู่ที่นี่แทนเพราะสินค้า 1 ชื่อในร้านมาได้จากหลายบริษัท แต่ละเจ้ามีรหัสของตัวเองไม่เหมือนกัน
	CompanyProductCode string `json:"company_product_code"`
}