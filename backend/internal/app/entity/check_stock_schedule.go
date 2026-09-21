package entity

import (
	"gorm.io/gorm"
	"time"
)

type CheckStockSchedule struct {
	gorm.Model
	Scheduled_DateTime     time.Time `json:"scheduled_datetime"`
	Scheduled_End_DateTime time.Time `json:"scheduled_end_datetime"`
	Status                 string    `json:"status"` // "รอดำเนินการ", "กำลังเช็ค", "รอตรวจสอบ" (พนักงานนับเสร็จ ส่งให้เจ้าของร้านตรวจ), "เสร็จสิ้น"
	Note                   string    `json:"note"`

	// Check Type: "LOCATION", "CATEGORY", "PRODUCT"
	CheckType string `json:"check_type"`

	// Target Fields (ของเดิม เก็บไว้เผื่อตารางเก่าก่อนรองรับเลือกหลายเป้าหมาย/หลายรายการยังมีแค่ฟิลด์เดี่ยวพวกนี้
	// ตารางที่สร้าง/แก้ไขใหม่ตั้งแต่รองรับหลายเป้าหมายแล้วจะไม่เซ็ตฟิลด์พวกนี้อีก ใช้ Targets ด้านล่างแทน)
	ZoneID           *uint `json:"zone_id"`
	ShelfID          *uint `json:"shelf_id"`
	ShelfLevelID     *uint `json:"shelf_level_id"`
	CategoryID       *uint `json:"category_id"`
	SubCategoryID    *uint `json:"sub_category_id"`
	SubSubCategoryID *uint `json:"sub_sub_category_id"`
	ProductID        *uint `json:"product_id"`

	// Targets: เป้าหมายการตรวจของตารางนี้ เลือกได้หลายจุดพร้อมกัน (เช่น หลายโซน/หลายหมวดหมู่/หลายสินค้ารายตัว)
	// ในการมอบหมายครั้งเดียว — ตารางเก่าที่ยังไม่เคยตั้งหลายเป้าหมาย (Targets ว่าง) จะ fallback ไปอ่านฟิลด์เดี่ยว
	// ด้านบนแทน (ดู resolveTargets() ใน service)
	Targets []CheckStockScheduleTarget `gorm:"foreignKey:CheckStockScheduleID" json:"targets"`

	// ExcludedProducts: สินค้าที่เจ้าของร้านเอาออกจากรายการที่ระบบหามาให้อัตโนมัติ (เฉพาะ LOCATION/CATEGORY)
	ExcludedProducts []CheckStockScheduleExcludedProduct `gorm:"foreignKey:CheckStockScheduleID" json:"excluded_products"`

	// Assigned Employee
	UserID *uint `json:"user_id"`
	User   *User `gorm:"foreignKey:UserID" json:"user"`

	// AccessToken: รหัสเฉพาะของตารางนี้ ผูกไปกับ QR Code ให้พนักงานที่ได้รับมอบหมายสแกนแล้วเข้าหน้าเช็คสต็อกได้เลย
	// โดยไม่ต้องล็อกอินในมือถือก่อน (สร้างครั้งเดียวตอนสร้างตาราง ใช้ซ้ำได้ตลอดอายุของตารางนี้)
	AccessToken string `gorm:"uniqueIndex;size:64" json:"access_token"`

	CheckStocks []CheckStock `gorm:"foreignKey:CheckStockScheduleID" json:"check_stocks"`
}
