package purchaseorders

import (
	"time"
	poEnum "backend/internal/app/enum"
)

type POItemDTO struct {
	ProductID 			uint  			`json:"product_id" binding:"required"`
	Quantity  			int     		`json:"quantity" binding:"required,gt=0"` 	// จำนวนต้องมากกว่า 0
	UnitPrice			float64			`json:"unit_price" binding:"required,gt=0"` // ราคาต่อหน่วยต้องมากกว่า 0
	Notes          		*string  		`json:"notes"` 								// ใช้ * เพื่อให้เป็น Optional (ส่งมาเป็น null หรือไม่ส่งก็ได้)
	AlertID        		*uint    		`json:"alert_id"`          
	PreOrderItemID 		*uint    		`json:"pre_order_item_id"`
}

type CreatePurchaseOrderRequest struct {
	SupplierID			uint			`json:"supplier_id" binding:"required"`
	Notes				*string			`json:"notes" binding:"required"`
	Status				poEnum.POStatus	`json:"status" binding:"required,oneof=DRAFT PENDING"`
	POItems				[]POItemDTO 	`json:"po_items" binding:"required,gt=0"`
}

type PurchaseOrderResponse struct {
	ID					uint			`json:"id"`
	PONumber			string 			`json:"po_number"`
	SupplierID			uint			`json:"supplier_id"`
	SupplierName		string 			`json:"supplier_name"`
	POTypeID			uint 			`json:"po_type_id"`
	TotalAmount			float64 		`json:"total_amount"`
	Status				poEnum.POStatus   `json:"status"`
	Notes				*string			`json:"notes"`
	CreatorID    		uint            `json:"creator_id"`
	CreatorName  		string          `json:"creator_name"`
	CreatedAt    		time.Time       `json:"created_at"`
	UpdatedByID  		*uint           `json:"updated_by_id,omitempty"`
	UpdatedByName		*string         `json:"updated_by_name,omitempty"`
	UpdatedAt    		time.Time       `json:"updated_at"`
	POItems      		[]POItemResponse `json:"po_items,omitempty"`
}

type POItemResponse struct {
	ID                        	uint     `json:"id"`
	ProductID                 	uint     `json:"product_id"`
	ProductNameSnapshot       	string   `json:"product_name_snapshot"`      // ชื่อสินค้า ณ วันที่กดสั่งซื้อ
	SupplyProductCodeSnapshot 	string   `json:"product_name_code_snapshot"` // รหัสสินค้า ณ วันที่กดสั่งซื้อ
	Quantity                  	int      `json:"quantity"`
	Unit                      	string   `json:"unit"`
	UnitPrice                 	float64  `json:"unit_price"`
	SubTotal                  	float64  `json:"sub_total"`   // ยอดรวมของแถวนี้ (Quantity * UnitPrice)
	Notes                     	string   `json:"notes,omitempty"`
	AlertID                   	*uint    `json:"alert_id,omitempty"`
	PreOrderItemID            	*uint    `json:"pre_order_item_id,omitempty"`
	OrderType                   string   `json:"order_type"`
}

// Struct สำหรับเก็บข้อมูลรายบริษัทที่ถูกไม่อนุมัติ
type SupplierRejectedSummary struct {
    SupplierName string  `json:"supplier_name"`
    Amount       float64 `json:"amount"`
}

// Struct สำหรับส่งสรุป
type POSummaryResponse struct {
	MonthlyApprovedCount     int64                     `json:"monthly_approved_count"`
	MonthlyApprovedLastCount int64                     `json:"monthly_approved_last_count"`
	ApprovedChangePercent    float64                   `json:"approved_change_percent"`

	PendingAmount            float64                   `json:"pending_amount"`
	ApprovedMTDAmount        float64                   `json:"approved_mtd_amount"`
	ApprovedLastMonthAmount  float64                   `json:"approved_last_month_amount"`

	RejectedMTDAmount        float64                   `json:"rejected_mtd_amount"`
	RejectedBySupplier       []SupplierRejectedSummary `json:"rejected_by_supplier"`
}

type ListPOQuery struct {
	Page   int    `form:"page"`
	Limit  int    `form:"limit"`
	Status string `form:"status"` // เช่น PENDING, APPROVED
	Search string `form:"search"` // ค้นหาด้วย po_number
	Year   string `form:"year"`  // ค.ศ. เช่น "2025"
	Month  string `form:"month"` // "01"-"12"
}

// Struct สำหรับตอบกลับ (ตรงกับที่ Frontend รอรับ)
type ListPOResponse struct {
	Data  []PurchaseOrderResponse `json:"data"`  // POResponse คือ DTO ของข้อมูล PO 1 ตัวที่คุณน่าจะมีอยู่แล้ว
	Total int64        `json:"total"` // จำนวนข้อมูลทั้งหมด
}

type DeletePORequest struct {
	ID uint `uri:"id" binding:"required"`
}

// รับค่าจาก Query Parameters
type ProductSearchQuery struct {
	Keyword    string `form:"q"`
	SupplierID string `form:"supplier_id" binding:"required"` // binding:"required" ของ Gin จะช่วยดัก Error ให้ถ่าหน้าบ้านลืมส่ง
}

// หน้าตาข้อมูลที่จะส่งกลับไปให้หน้าบ้าน
type ProductSearchResponse struct {
	ID       int     `json:"id"`
	Code     string  `json:"code"`
	Barcode  string  `json:"barcode"`
	Name     string  `json:"name"`
	Price    float64 `json:"price"`
	Unit     string  `json:"unit"`
	StockQty int     `json:"stock_qty"`
}

// แก้ไข PO กับ POItems
type UpdatePurchaseOrderRequest struct {
	SupplierID *uint                    `json:"supplier_id"`
	POTypeID   *uint                    `json:"po_type_id"`
	Notes      *string                  `json:"notes"`
	Items      []UpdatePOItemRequest    `json:"items"` // ส่งมาทั้งชุด = replace ทั้งหมด
}

type UpdatePOItemRequest struct {
	ID         *uint   `json:"id"`          // nil = item ใหม่, มีค่า = item เดิม
	ProductID  uint    `json:"product_id"`
	Quantity   float64 `json:"quantity"`
	UnitPrice  float64 `json:"unit_price"`
	AlertID    *uint   `json:"alert_id,omitempty"`
	PreOrderItemID  *uint   `json:"pre_order_item_id,omitempty"`
}

// POAnalyticsResponse DTO สำหรับส่งข้อมูลการคาดการณ์กลับไปให้ Frontend
type POAnalyticsResponse struct {
	SupplierID    int     `json:"supplier_id"`
	HasEnoughData bool    `json:"has_enough_data"`
	EstimatedDays int     `json:"estimated_days"`
	AccuracyRate  float64 `json:"accuracy_rate"`
}