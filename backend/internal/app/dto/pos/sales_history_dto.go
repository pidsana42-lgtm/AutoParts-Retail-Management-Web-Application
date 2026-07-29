package pos

import (
	"backend/internal/app/entity"
	"time"
)

// SalesHistoryFilterRequest โครงสร้างข้อมูลที่รับมาจาก Query String หน้าเว็บ
type SalesHistoryFilterRequest struct {
	Search          string `form:"search"`           
	StartDate       string `form:"start_date"`      
	EndDate         string `form:"end_date"`       
	CustomerTypeID  uint   `form:"customer_type_id"` 
	PaymentMethodID uint   `form:"payment_method_id"`
	Page            int    `form:"page,default=1"`
	Limit           int    `form:"limit,default=15"`
}

// โครงสร้างข้อมูลประวัติการขาย 1 รายการ ที่จะส่งกลับไปแสดงผลที่ Frontend
type SalesHistoryItemResponse struct {
	ID                uint      `json:"id"`
	OrderNumber       string    `json:"order_number"`
	OrderDate         time.Time `json:"order_date"`
	CreatedAt         time.Time `json:"created_at"`
	
	CustomerID        *uint   `json:"customer_id"`
	CustomerName      string  `json:"customer_name"`
	CustomerPhone     string  `json:"customer_phone"`
	
	Subtotal          float64 `json:"subtotal"`
	DiscountAmount    float64 `json:"discount_amount"`
	TotalAmount       float64 `json:"total_amount"`
	PaidAmount        float64 `json:"paid_amount"`
	BalanceDue        float64 `json:"balance_due"`
	
	PaymentMethodName string  `json:"payment_method_name"`
	Status            string  `json:"status"`
	PaymentStatus     string  `json:"payment_status"`
}

// SalesHistoryPaginationResponse โครงสร้างข้อมูลครอบทั้งหมดที่มีข้อมูล Pagination แปะไปด้วย
type SalesHistoryPaginationResponse struct {
    Items      []SalesHistoryItemResponse `json:"items"`       // items: Array ของรายการประวัติการขาย
    Page       int                        `json:"page"`        // page: เลขหน้าปัจจุบัน
    Limit      int                        `json:"limit"`       // limit: จำนวนรายการต่อหน้าที่ตั้งไว้
    TotalRows  int64                      `json:"total_rows"`  // total_rows: จำนวนรายการทั้งหมดในระบบที่ตรงเงื่อนไข
    TotalPages int                        `json:"total_pages"` // total_pages: จำนวนหน้าทั้งหมด
}

func ToSalesHistoryItemResponse(order entity.SaleOrder) SalesHistoryItemResponse {
    customerName := ""
    customerPhone := ""

    if order.CustomerNameTemp != nil {
        customerName = *order.CustomerNameTemp
    }
    if order.CustomerPhoneTemp != nil {
        customerPhone = *order.CustomerPhoneTemp
    }

    if order.Customer.ID != 0 {
        customerName = order.Customer.CustomerName
        customerPhone = order.Customer.PhoneNumber
    }

    paymentMethodName := "-"
    
    // 1. เช็คจาก PaymentMethod ที่ผูกไว้ที่หัวบิลก่อน (ครอบคลุมบิลเงินเชื่อที่ระบุไว้ตอนสร้างออเดอร์)
    if order.PaymentMethod != nil && order.PaymentMethod.MethodName != "" {
        paymentMethodName = order.PaymentMethod.MethodName
    } else if len(order.Payments) > 0 && order.Payments[0].PaymentMethod.MethodName != "" {
        // 2. Fallback: ถ้าที่หัวบิลไม่ได้ลงไว้ ให้ดึงจากรายการชำระเงิน Payment ตัวแรก
        paymentMethodName = order.Payments[0].PaymentMethod.MethodName
    }

    return SalesHistoryItemResponse{
        ID:                order.ID,
        OrderNumber:       order.OrderNumber,
        OrderDate:         order.OrderDate,
        CreatedAt:         order.CreatedAt,
        CustomerID:        order.CustomerID,
        CustomerName:      customerName,
        CustomerPhone:     customerPhone,
        Subtotal:          order.Subtotal,
        DiscountAmount:    order.DiscountAmount,
        TotalAmount:       order.TotalAmount,
        PaidAmount:        order.PaidAmount,
        BalanceDue:        order.BalanceDue,
        PaymentMethodName: paymentMethodName,
        Status:            string(order.Status),
        PaymentStatus:     string(order.PaymentStatus),
    }
}

func ToSalesHistoryItemResponseList(orders []entity.SaleOrder) []SalesHistoryItemResponse {
	list := []SalesHistoryItemResponse{}
	for _, o := range orders {
		list = append(list, ToSalesHistoryItemResponse(o))
	}
	return list
}