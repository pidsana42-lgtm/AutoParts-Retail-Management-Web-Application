package entity

import (
	"time"

	"gorm.io/gorm"
)

type StockMovement struct {
	gorm.Model
	Movement_Type string `json:"movement_type"`
	Quantity int `json:"quantity"`
	Movement_DateTime time.Time `json:"movement_datetime"`
	Note string `json:"note"`

	ProductID uint `json:"product_id"`
	Product *Product `gorm:"foreignKey:ProductID" json:"product"`
	SupplierID *uint `json:"supplier_id"`
	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier"`
	// UserID: ผู้ทำรายการ — เป็น pointer เพราะบางเส้นทางที่บันทึกอัตโนมัติ (เช่น รับสินค้าเข้าเพิ่มจากหน้า WMS)
	// ยังไม่มี context ผู้ใช้ที่ authenticated ให้ผูก ต้องปล่อยเป็น NULL ได้ ไม่งั้นจะชน FK constraint (user_id=0 ไม่มีอยู่จริง)
	UserID *uint `json:"user_id"`
	User   *User `gorm:"foreignKey:UserID" json:"user"`
	SaleOrderID *uint `json:"sale_order_id"`
	SaleOrder *SaleOrder `gorm:"foreignKey:SaleOrderID" json:"sale_order"`
	BillID *uint `json:"bill_id"`
	Bill *Bill `gorm:"foreignKey:BillID" json:"bill"`
}