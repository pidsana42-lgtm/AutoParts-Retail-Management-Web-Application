package entity

import "gorm.io/gorm"

// CheckStockScheduleTarget: 1 แถว = เป้าหมายการตรวจ 1 จุดที่เลือกไว้ในตารางเช็คสต็อกนี้ ตารางเดียวเลือกได้
// หลายจุดพร้อมกัน (เช่น เลือกหลายโซน หรือหลายหมวดหมู่) มอบหมายพนักงานคนเดียวไปตรวจรวดเดียวในการมอบหมายครั้งเดียว
type CheckStockScheduleTarget struct {
	gorm.Model
	CheckStockScheduleID uint `json:"check_stock_schedule_id"`

	// TargetType: "ZONE" | "SHELF" | "SHELF_LEVEL" | "CATEGORY" | "SUB_CATEGORY" | "SUB_SUB_CATEGORY" | "PRODUCT"
	TargetType string `json:"target_type"`
	TargetID   uint   `json:"target_id"`
}
