package wms

import "time"

type CheckStockScheduleRequestDTO struct {
	Scheduled_DateTime     time.Time `json:"scheduled_datetime" binding:"required"`
	Scheduled_End_DateTime time.Time `json:"scheduled_end_datetime" binding:"required,gtfield=Scheduled_DateTime"`
	Note                   string    `json:"note"`
	CheckType              string    `json:"check_type" binding:"required"` // "LOCATION", "CATEGORY", "PRODUCT"

	// เป้าหมายการตรวจ — เลือกได้หลายจุดพร้อมกันในการมอบหมายครั้งเดียว (เช่น หลายโซน/หลายหมวดหมู่/หลายสินค้ารายตัว)
	ZoneIDs           []uint `json:"zone_ids"`
	ShelfIDs          []uint `json:"shelf_ids"`
	ShelfLevelIDs     []uint `json:"shelf_level_ids"`
	CategoryIDs       []uint `json:"category_ids"`
	SubCategoryIDs    []uint `json:"sub_category_ids"`
	SubSubCategoryIDs []uint `json:"sub_sub_category_ids"`
	ProductIDs        []uint `json:"product_ids"`

	// ExcludedProductIDs: สินค้าที่เอาออกจากรายการที่ระบบหามาให้อัตโนมัติ (เฉพาะ LOCATION/CATEGORY)
	ExcludedProductIDs []uint `json:"excluded_product_ids"`

	UserID *uint `json:"user_id"`
}

type CheckStockScheduleResponseDTO struct {
	ID                     uint      `json:"id"`
	Scheduled_DateTime     time.Time `json:"scheduled_datetime"`
	Scheduled_End_DateTime time.Time `json:"scheduled_end_datetime"`
	Status                 string    `json:"status"`
	Note                   string    `json:"note"`
	CreatedAt              time.Time `json:"created_at"`

	CheckType string `json:"check_type"`

	// เป้าหมายการตรวจของตารางนี้ ในรูปแบบ array เสมอ (ตารางเก่าที่มีแค่เป้าหมายเดียวจะถูก wrap เป็น array 1 ช่อง
	// ให้หน้าเว็บใช้ตรรกะเดียวกันได้ทั้งตารางเก่า/ใหม่ ดู resolveTargets() ใน service)
	ZoneIDs           []uint `json:"zone_ids"`
	ShelfIDs          []uint `json:"shelf_ids"`
	ShelfLevelIDs     []uint `json:"shelf_level_ids"`
	CategoryIDs       []uint `json:"category_ids"`
	SubCategoryIDs    []uint `json:"sub_category_ids"`
	SubSubCategoryIDs []uint `json:"sub_sub_category_ids"`
	ProductIDs        []uint `json:"product_ids"`

	ExcludedProductIDs []uint `json:"excluded_product_ids"`

	UserID       *uint  `json:"user_id"`
	UserFullName string `json:"user_full_name"`
	AccessToken  string `json:"access_token"`

	// Derived Fields for UI
	TargetName   string `json:"target_name"`   // e.g., "Zone A (RACK 04 - LEVEL 2)" or "หลายหมวดหมู่ (2): Engine Parts, Brake Parts"
	ProductCount int    `json:"product_count"` // Number of products expected in this check (หลัง union หลายเป้าหมาย และหักสินค้าที่เอาออกแล้ว)
}
