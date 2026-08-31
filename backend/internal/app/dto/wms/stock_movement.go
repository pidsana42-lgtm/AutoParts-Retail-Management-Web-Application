package wms

import "time"

// Movement_Type ที่รองรับ
// "IN"     = นำเข้าสินค้า (มี BillID / SupplierID)
// "OUT"    = ขายออก       (มี SaleOrderID)
// "RETURN" = คืนสินค้า    (มี SaleOrderID หรือ BillID)
// "CLAIM"  = เคลม         (มี SupplierID)

type StockMovementRequestDTO struct {
	Movement_Type     string    `json:"movement_type" binding:"required,oneof=IN OUT RETURN CLAIM"`
	Quantity          int       `json:"quantity" binding:"required,min=1"`
	Movement_DateTime time.Time `json:"movement_datetime" binding:"required"`
	Note              string    `json:"note"`

	ProductID    uint  `json:"product_id" binding:"required"`
	UserID       uint  `json:"user_id" binding:"required"`
	SupplierID   *uint `json:"supplier_id"`   // IN, CLAIM
	SaleOrderID  *uint `json:"sale_order_id"` // OUT, RETURN
	BillID       *uint `json:"bill_id"`       // IN, RETURN
}

type StockMovementResponseDTO struct {
	ID                uint      `json:"id"`
	Movement_Type     string    `json:"movement_type"`
	Quantity          int       `json:"quantity"`
	Movement_DateTime time.Time `json:"movement_datetime"`
	Note              string    `json:"note"`
	ProductID         uint      `json:"product_id"`
	ProductName       string    `json:"product_name"`
	UserID            *uint     `json:"user_id"`
	SupplierID        *uint     `json:"supplier_id"`
	SupplierName      string    `json:"supplier_name,omitempty"`
	SaleOrderID       *uint     `json:"sale_order_id"`
	BillID            *uint     `json:"bill_id"`
	CreatedAt         time.Time `json:"created_at"`
}
