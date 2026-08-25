package entity

import "gorm.io/gorm"

// Notification: การแจ้งเตือนที่บันทึกลง DB ไว้ด้วย (ต่างจาก websocket broadcast เดิมที่หายไปเมื่อรีเฟรชหน้า)
// ผู้รับ (เลือกได้ทางเดียวต่อ 1 แถว):
//   - Broadcast = true       -> แจ้งทุกคนที่ล็อกอินอยู่ (ของเดิม เช่น ใบเคลม/พรีออเดอร์ใหม่)
//   - ForOwners = true       -> แจ้งเฉพาะเจ้าของร้าน/แอดมินทุกคน (เช่น พนักงานส่งผลนับสต็อกมาให้ตรวจ)
//   - ForEmployees = true    -> แจ้งพนักงานทุกคน (เช่น มีการเช็คสต็อกโซน/หมวดหมู่นี้อยู่ ให้คนอื่นรู้เผื่อไปแก้สต็อกทับกัน)
//   - TargetUserID != nil    -> แจ้งพนักงานคนนั้นคนเดียว (เช่น อนุมัติ/ตีกลับผลนับสต็อก)
//
// หมายเหตุ ForOwners/ForEmployees: is_read เป็นสถานะรวมของทั้งกลุ่ม (ใครกดอ่านแล้ว/ล้างแล้ว มีผลกับทุกคนในกลุ่มนั้น)
// เหมือนกับ ForOwners ที่มีอยู่เดิม ไม่ได้แยก read state รายคน
type Notification struct {
	gorm.Model
	Type    string `json:"type"`
	Title   string `json:"title"`
	Message string `json:"message"`
	Link    string `json:"link"`
	IsRead  bool   `json:"is_read"`

	Broadcast    bool  `json:"broadcast"`
	ForOwners    bool  `json:"for_owners"`
	ForEmployees bool  `json:"for_employees"`
	TargetUserID *uint `json:"target_user_id"`

	CheckStockScheduleID *uint `json:"check_stock_schedule_id"`
}
