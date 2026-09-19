package returns

import (
	"time"

	"backend/internal/app/entity"
	reEnum "backend/internal/app/enum"
)

type ReturnStatusCount struct {
	Status reEnum.ReturnStatus `json:"status"`
	Count  int64               `json:"count"`
}

type ReturnListItem struct {
	ID              uint                `json:"id"`
	ReturnNumber    string              `json:"return_number"`
	OriginalOrderID uint                `json:"original_order_id"`
	Status          reEnum.ReturnStatus `json:"status"`
	Reason          string              `json:"reason"`
	RefundAmount    float64             `json:"refund_amount"`
	RefundMethod    string              `json:"refund_method"`
	RequestedAt     string              `json:"requested_at"`
	ApprovedAt      *string             `json:"approved_at,omitempty"`
	RefundedAt      *string             `json:"refunded_at,omitempty"`
	Note            string              `json:"note"`
}

type GetReturnsRequest struct {
	Status   string `form:"status"`
	Search   string `form:"search"`
	Page     int    `form:"page"`
	PageSize int    `form:"page_size"`
}

type GetReturnsResponse struct {
	Data         []ReturnListItem    `json:"data"`
	StatusCounts []ReturnStatusCount `json:"status_counts"`
	TotalCount   int64               `json:"total_count"`
	Page         int                 `json:"page"`
	PageSize     int                 `json:"page_size"`
}

type ReturnableSaleOrderItemDTO struct {
	ProductID   uint    `json:"product_id"`
	ProductName string  `json:"product_name"`
	ProductCode string  `json:"product_code"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
}

type ReturnableSaleOrderDTO struct {
	ID           uint                         `json:"id"`
	OrderNumber  string                       `json:"order_number"`
	SoldAt       string                       `json:"sold_at"`
	CustomerID   *uint                        `json:"customer_id,omitempty"`
	CustomerName string                       `json:"customer_name,omitempty"`
	EmployeeName string                       `json:"employee_name,omitempty"`
	Items        []ReturnableSaleOrderItemDTO `json:"items"`
}

type SearchReturnableSaleOrdersRequest struct {
	Search string `form:"search"`
}

type CreateReturnItemInputDTO struct {
	ProductID   uint    `json:"product_id" binding:"required"`
	ProductName string  `json:"product_name,omitempty"`
	ProductCode string  `json:"product_code,omitempty"`
	Quantity    int     `json:"quantity" binding:"required,min=1"`
	UnitPrice   float64 `json:"unit_price" binding:"gt=0"`
}

type CreateReturnDTO struct {
	ReturnNumber    string     `json:"return_number,omitempty"`
	OriginalOrderID uint       `json:"original_order_id" binding:"required"`
	ReturnDate      *time.Time `json:"return_date,omitempty"`
	Reason          string     `json:"reason" binding:"required"`
	RefundAmount    float64    `json:"refund_amount" binding:"gte=0"`
	RefundMethod    string     `json:"refund_method" binding:"required"`
	RequestedAt     *time.Time `json:"requested_at,omitempty"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	Note            string     `json:"note,omitempty"`
	CreatedBy       uint       `json:"created_by,omitempty"`
	ApprovedBy      *uint      `json:"approved_by,omitempty"`
	Status          string     `json:"status,omitempty"`
	// binding:"dive" จำเป็นต่อการให้ go-playground/validator ลงไป validate field ใน struct ของแต่ละ
	// element จริงๆ — ไม่งั้น required/min ที่ CreateReturnItemInputDTO จะถูกข้ามไปเงียบๆ ทั้งอาเรย์
	SalesReturnItems []CreateReturnItemInputDTO `json:"sales_return_items,omitempty" binding:"omitempty,dive"`
	Items            []CreateReturnItemInputDTO `json:"items,omitempty" binding:"omitempty,dive"`
}

type UpdateReturnDTO struct {
	ReturnDate   *time.Time `json:"return_date,omitempty"`
	Status       string     `json:"status,omitempty"`
	Reason       string     `json:"reason,omitempty"`
	RefundAmount float64    `json:"refund_amount,omitempty" binding:"gte=0"`
	RefundMethod string     `json:"refund_method,omitempty"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	Note         string     `json:"note,omitempty"`
	ApprovedBy   *uint      `json:"approved_by,omitempty"`
}

type ReturnItemDetailDTO struct {
	ID            uint      `json:"id"`
	SalesReturnID uint      `json:"sales_return_id"`
	ProductID     uint      `json:"product_id"`
	ProductName   string    `json:"product_name,omitempty"`
	ProductCode   string    `json:"product_code,omitempty"`
	Quantity      int       `json:"quantity"`
	UnitPrice     float64   `json:"unit_price"`
	Subtotal      float64   `json:"subtotal"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type ReturnDetailResponseDTO struct {
	ID               uint                  `json:"id"`
	ReturnNumber     string                `json:"return_number"`
	OriginalOrderID  uint                  `json:"original_order_id"`
	OriginalOrder    *entity.SaleOrder     `json:"original_order,omitempty"`
	ReturnDate       time.Time             `json:"return_date"`
	Status           reEnum.ReturnStatus   `json:"status"`
	Reason           string                `json:"reason"`
	RefundAmount     float64               `json:"refund_amount"`
	RefundMethod     string                `json:"refund_method"`
	RequestedAt      time.Time             `json:"requested_at"`
	ApprovedAt       *time.Time            `json:"approved_at,omitempty"`
	RefundedAt       *time.Time            `json:"refunded_at,omitempty"`
	Note             string                `json:"note"`
	CreatedBy        uint                  `json:"created_by"`
	CreatedByUser    *entity.User          `json:"created_by_user,omitempty"`
	ApprovedBy       *uint                 `json:"approved_by,omitempty"`
	RefundedBy       *uint                 `json:"refunded_by,omitempty"`
	ApprovedByUser   *entity.User          `json:"approved_by_user,omitempty"`
	SalesReturnItems []ReturnItemDetailDTO `json:"sales_return_items,omitempty"`
	CreatedAt        time.Time             `json:"created_at"`
	UpdatedAt        time.Time             `json:"updated_at"`
}

func (d *CreateReturnDTO) ToEntity() entity.SalesReturn {
	returnDate := time.Now()
	if d.ReturnDate != nil && !d.ReturnDate.IsZero() {
		returnDate = *d.ReturnDate
	}
	requestedAt := time.Now()
	if d.RequestedAt != nil && !d.RequestedAt.IsZero() {
		requestedAt = *d.RequestedAt
	}
	status := reEnum.ReturnPending
	if d.Status != "" {
		status = reEnum.ReturnStatus(d.Status)
	}

	return entity.SalesReturn{
		ReturnNumber:    d.ReturnNumber,
		OriginalOrderID: d.OriginalOrderID,
		ReturnDate:      returnDate,
		Status:          status,
		Reason:          d.Reason,
		RefundAmount:    d.RefundAmount,
		RefundMethod:    d.RefundMethod,
		RequestedAt:     requestedAt,
		ApprovedAt:      d.ApprovedAt,
		Note:            d.Note,
		CreatedBy:       d.CreatedBy,
		ApprovedBy:      d.ApprovedBy,
	}
}

func (d *UpdateReturnDTO) ToEntity(existing entity.SalesReturn) entity.SalesReturn {
	if d.ReturnDate != nil && !d.ReturnDate.IsZero() {
		existing.ReturnDate = *d.ReturnDate
	}
	if d.Status != "" {
		existing.Status = reEnum.ReturnStatus(d.Status)
		if (existing.Status == reEnum.ReturnApproved || existing.Status == reEnum.ReturnRejected) && existing.ApprovedAt == nil {
			now := time.Now()
			existing.ApprovedAt = &now
		}
	}
	if d.Reason != "" {
		existing.Reason = d.Reason
	}
	if d.RefundAmount > 0 {
		existing.RefundAmount = d.RefundAmount
	}
	if d.RefundMethod != "" {
		existing.RefundMethod = d.RefundMethod
	}
	if d.ApprovedAt != nil {
		existing.ApprovedAt = d.ApprovedAt
	}
	if d.Note != "" {
		existing.Note = d.Note
	}
	if d.ApprovedBy != nil {
		existing.ApprovedBy = d.ApprovedBy
	}
	return existing
}

func ToReturnDetailResponseDTO(m *entity.SalesReturn) ReturnDetailResponseDTO {
	items := make([]ReturnItemDetailDTO, 0, len(m.SalesReturnItems))
	for _, item := range m.SalesReturnItems {
		prodName := ""
		prodCode := ""
		if item.Product != nil {
			prodName = item.Product.Product_Name
			prodCode = item.Product.Product_Code
			if prodCode == "" {
				prodCode = item.Product.Part_Number
			}
		}
		subtotal := item.Subtotal
		if subtotal <= 0 {
			subtotal = float64(item.Quantity) * item.UnitPrice
		}
		items = append(items, ReturnItemDetailDTO{
			ID:            item.ID,
			SalesReturnID: item.SalesReturnID,
			ProductID:     item.ProductID,
			ProductName:   prodName,
			ProductCode:   prodCode,
			Quantity:      item.Quantity,
			UnitPrice:     item.UnitPrice,
			Subtotal:      subtotal,
			CreatedAt:     item.CreatedAt,
			UpdatedAt:     item.UpdatedAt,
		})
	}

	return ReturnDetailResponseDTO{
		ID:               m.ID,
		ReturnNumber:     m.ReturnNumber,
		OriginalOrderID:  m.OriginalOrderID,
		OriginalOrder:    m.OriginalOrder,
		ReturnDate:       m.ReturnDate,
		Status:           m.Status,
		Reason:           m.Reason,
		RefundAmount:     m.RefundAmount,
		RefundMethod:     m.RefundMethod,
		RequestedAt:      m.RequestedAt,
		ApprovedAt:       m.ApprovedAt,
		RefundedAt:       m.RefundedAt,
		Note:             m.Note,
		CreatedBy:        m.CreatedBy,
		CreatedByUser:    m.CreatedByUser,
		ApprovedBy:       m.ApprovedBy,
		RefundedBy:       m.RefundedBy,
		ApprovedByUser:   m.ApprovedByUser,
		SalesReturnItems: items,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}
