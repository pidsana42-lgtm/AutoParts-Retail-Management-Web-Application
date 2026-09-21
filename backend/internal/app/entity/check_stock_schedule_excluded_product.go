package entity

import "gorm.io/gorm"

// CheckStockScheduleExcludedProduct: สินค้าที่เจ้าของร้านตั้งใจ "เอาออก" จากรายการที่ระบบหามาให้อัตโนมัติ
// ใช้เฉพาะตารางแบบ LOCATION/CATEGORY ที่หาสินค้าจากโซน/หมวดหมู่ที่เลือกไว้ (แบบ PRODUCT เลือกสินค้าตรงๆ อยู่แล้ว
// ไม่มีรายการที่ต้อง "เอาออก" อีก)
type CheckStockScheduleExcludedProduct struct {
	gorm.Model
	CheckStockScheduleID uint `json:"check_stock_schedule_id"`
	ProductID            uint `json:"product_id"`
}
