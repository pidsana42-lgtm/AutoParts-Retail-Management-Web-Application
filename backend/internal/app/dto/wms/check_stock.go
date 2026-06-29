package wms

import "time"

type CheckStockRequestDTO struct {
	Old_Quantity         int       `json:"old_quantity" binding:"required,min=0"`
	New_Quantity         int       `json:"new_quantity" binding:"required,min=0"`
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
