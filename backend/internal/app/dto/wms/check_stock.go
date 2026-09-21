package wms

import "time"

type CheckStockRequestDTO struct {
	// ห้ามใส่ "required" ที่สองฟิลด์นี้ — ค่า 0 เป็นจำนวนที่นับได้จริง (สินค้าหมดสต็อกพอดี) ไม่ใช่ค่าที่ไม่ได้กรอก
	// แต่ validator ของ Gin มองว่า 0 คือ zero value ของ int แล้วตัดสินว่า "required" ไม่ผ่านทุกครั้งที่นับได้ 0
	Old_Quantity         int       `json:"old_quantity" binding:"min=0"`
	New_Quantity         int       `json:"new_quantity" binding:"min=0"`
	Reason               string    `json:"reason"`
	Adjustment_DateTime  time.Time `json:"adjustment_datetime" binding:"required"`
	ProductID            uint      `json:"product_id" binding:"required"`
	SupplierID           uint      `json:"supplier_id"`
	UserID               uint      `json:"user_id" binding:"required"`
	CheckStockScheduleID *uint     `json:"check_stock_schedule_id"`
}

type CheckStockResponseDTO struct {
	ID                   uint      `json:"id"`
	Old_Quantity         int       `json:"old_quantity"`
	New_Quantity         int       `json:"new_quantity"`
	Diff_Quantity        int       `json:"diff_quantity"`
	Reason               string    `json:"reason"`
	Adjustment_DateTime  time.Time `json:"adjustment_datetime"`
	ProductID            uint      `json:"product_id"`
	SupplierID           uint      `json:"supplier_id"`
	UserID               uint      `json:"user_id"`
	CheckStockScheduleID *uint     `json:"check_stock_schedule_id"`
	CreatedAt            time.Time `json:"created_at"`
}
