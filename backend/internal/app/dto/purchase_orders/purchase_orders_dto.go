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
	POTypeID 			uint			`json:"po_type_id" binding:"required"`
	POItems				[]POItemDTO 	`json:"po_items" binding:"required,gt=0"`
}

type PurchaseOrderResponse struct {
	ID					uint			`json:"id"`
	OrderNumber			string 			`json:"order_number"`
	SupplierID			uint			`json:"supplier_id"`
	SupplierName		string 			`json:"supplier_name"`
	POTypeID			uint 			`json:"po_type_id"`
	TotalAmount			float64 		`json:"total_amount"`
	Status				poEnum.POStatus   `json:"status"`
	CreatorID    		uint            `json:"creator_id"`
	CreatorName  		string          `json:"creator_name"`
	CreatedAt    		time.Time       `json:"created_at"`
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
}

type POSummaryResponse struct {
    PendingAmount     	float64 	`json:"pending_amount"`
    ApprovedMTDAmount 	float64 	`json:"approved_mtd_amount"`
    RejectedMTDAmount 	float64 	`json:"rejected_mtd_amount"`
}

type ListPOQuery struct {
	Page   int    `form:"page"`
	Limit  int    `form:"limit"`
	Status string `form:"status"` // เช่น PENDING, APPROVED
	Search string `form:"search"` // ค้นหาด้วย po_number
	Date   string `form:"date"`   // ค้นหาด้วยวันที่สร้าง
}

// Struct สำหรับตอบกลับ (ตรงกับที่ Frontend รอรับ)
type ListPOResponse struct {
	Data  []PurchaseOrderResponse `json:"data"`  // POResponse คือ DTO ของข้อมูล PO 1 ตัวที่คุณน่าจะมีอยู่แล้ว
	Total int64        `json:"total"` // จำนวนข้อมูลทั้งหมด
}

type DeletePORequest struct {
	ID uint `uri:"id" binding:"required"`
}