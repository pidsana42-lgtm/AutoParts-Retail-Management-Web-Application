package entity

import (
	"gorm.io/gorm"
)
type SaleOrderItem struct {
    gorm.Model
    // FK
    OrderID uint      `gorm:"not null" json:"order_id" binding:"required"`
    Order   SaleOrder `gorm:"foreignKey:OrderID" json:"order"`

	//ProductID uint    `gorm:"not null" json:"product_id" binding:"required"`
	//Product   Product `gorm:"foreignKey:ProductID" json:"product"`

    // User ส่งมา
    PartNumber  string  `gorm:"type:varchar(100);not null" json:"part_number" binding:"required"`
    ProductName string  `gorm:"type:varchar(255);not null" json:"product_name" binding:"required"`
    Qty         int     `gorm:"not null" json:"qty" binding:"required,min=1"`
    Unit        string  `gorm:"type:varchar(50);not null" json:"unit" binding:"required"`
    UnitPrice   float64 `gorm:"type:decimal(15,2);not null" json:"unit_price" binding:"required"`

    // ระบบดึง/คำนวณเอง
    CostPrice       float64 `gorm:"type:decimal(15,2);not null" json:"cost_price"`
    DiscountPercent float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_percent"`
    FinalUnitPrice  float64 `gorm:"type:decimal(15,2);not null" json:"final_unit_price"`

    // Optional
    Note string `gorm:"type:varchar(255)" json:"note"`
}