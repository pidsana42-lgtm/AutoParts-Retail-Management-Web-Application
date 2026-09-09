package entity

import (
	"gorm.io/gorm"
)

type SaleOrderItem struct {
	gorm.Model
	// FK
	OrderNumber string `gorm:"type:varchar(100);not null" json:"order_number"`

	OrderID uint      `gorm:"not null" json:"order_id" binding:"required"`
	Order   SaleOrder `gorm:"foreignKey:OrderID" json:"order"`

	ProductID uint    `gorm:"not null" json:"product_id" binding:"required"`
	Product   Product `gorm:"foreignKey:ProductID" json:"product"`

	// User ส่งมา
	PartNumber  string  `gorm:"type:varchar(100);not null" json:"part_number" binding:"required"`
	ProductName string  `gorm:"type:varchar(255);not null" json:"product_name" binding:"required"`
	Qty         int     `gorm:"not null" json:"qty" binding:"required,min=1"`
	Unit        string  `gorm:"type:varchar(50);not null" json:"unit" binding:"required"`
	UnitPrice   float64 `gorm:"type:decimal(15,2);not null" json:"unit_price" binding:"required"`

	// ระบบดึง/คำนวณเอง
	CostPrice float64 `gorm:"type:decimal(15,2);not null" json:"cost_price"`
	// เพิ่ม
	DiscountType    string  `gorm:"type:varchar(20);not null;default:'none'" json:"discount_type"`    // 'none', 'percentage', 'amount'
	DiscountValue   float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_value"`   // ค่าดิบที่กรอก (เช่น 10% หรือ 50 บาท)
	DiscountPercent float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_percent"` // คิดเป็น % จริง
	DiscountAmount  float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"discount_amount"`  // มูลค่าส่วนลดรวมของแถวนี้ (บาท)

	FinalUnitPrice float64 `gorm:"type:decimal(15,2);not null" json:"final_unit_price"` // ราคาต่อหน่วยหลังหักส่วนลดแล้ว
	Subtotal       float64 `gorm:"type:decimal(15,2);not null" json:"subtotal"`         // เพิ่ม: ยอดสุทธิแถวนี้ (FinalUnitPrice * Qty)

	// Optional
	Note string `gorm:"type:varchar(255)" json:"note"`

	// เพิ่ม 2 ฟิลด์ใหม่นี้เข้าไปท้าย Struct เพื่อรองรับการกระจายเงินเฉลี่ยท้ายบิล
	AllocatedBillDiscount float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"allocated_bill_discount"`
	NetSubtotal           float64 `gorm:"type:decimal(15,2);not null;default:0.00" json:"net_subtotal"`

	// SupplierID: มีค่าเฉพาะตอนที่บาร์โค้ด/รหัสล็อตที่แสกน-พิมพ์ค้นหาตรงกับ Inventory ของ Supplier เจาะจงเท่านั้น
	// (nil = ไม่ทราบว่าขายจากล็อตของเจ้าไหน เช่น ค้นด้วยชื่อ/รหัสสินค้ากลางทั่วไป) ใช้หักคงเหลือต่อบริษัทให้ตรงเจ้าจริง
	SupplierID *uint     `json:"supplier_id,omitempty"`
	Supplier   *Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}
