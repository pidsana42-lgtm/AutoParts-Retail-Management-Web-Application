package wms

import "time"

// Alert_type ที่รองรับ เช่น "LOW_STOCK", "OUT_OF_STOCK"
// Is_Resolved: "true" / "false" (ตาม entity เป็น string)

type StockAlertRequestDTO struct {
	Alert_type        string `json:"alert_type" binding:"required"`
	Quantity_At_Alert int    `json:"quantity_at_alert" binding:"min=0"`
	Limit_Quantity    int    `json:"limit_quantity" binding:"min=0"`
	Is_Resolved       string `json:"is_resolved"`
	ProductID         uint   `json:"product_id" binding:"required"`
}

// สำหรับ PATCH สถานะการแก้ไข alert
type StockAlertUpdateDTO struct {
	Is_Resolved string `json:"is_resolved" binding:"required,oneof=true false"`
}

type StockAlertResponseDTO struct {
	ID                uint      `json:"id"`
	Alert_type        string    `json:"alert_type"`
	Quantity_At_Alert int       `json:"quantity_at_alert"`
	Limit_Quantity    int       `json:"limit_quantity"`
	Is_Resolved       string    `json:"is_resolved"`
	ProductID         *uint     `json:"product_id"`
	ProductName       string    `json:"product_name,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
}
