package pos

import (
	"backend/internal/app/entity"
	"strings"
	"time"
)

// Request DTO สำหรับพนักงานส่งคำขอยกเลิก
type RequestCancelOrderRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// Request DTO สำหรับเจ้าของร้านอนุมัติหรือปฏิเสธ
type ProcessCancelOrderRequest struct {
	Remark string `json:"remark"`
}

// Response DTO สำหรับการดึงคำขอยกเลิกบิลกลับ
type RevertCancellationRequestResponse struct {
	OrderID uint   `json:"order_id"`
	Status  string `json:"status"`
	Message string `json:"message"`
}

// SalesHistoryFilterRequest โครงสร้างข้อมูลที่รับมาจาก Query String หน้าเว็บ
type SalesHistoryFilterRequest struct {
	Search          string `form:"search"`
	StartDate       string `form:"start_date"`
	EndDate         string `form:"end_date"`
	CustomerType    string `form:"customer_type" json:"customer_type"`
	CustomerTypeID  uint   `form:"customer_type_id"`
	PaymentMethodID uint   `form:"payment_method_id"`
	PaymentMethod   string `form:"payment_method" json:"payment_method"`
	Status          string `form:"status" json:"status"`
	EmployeeID      uint   `form:"employee_id" json:"employee_id"`
	Page            int    `form:"page,default=1"`
	Limit           int    `form:"limit,default=15"`
}

// โครงสร้างข้อมูลประวัติการขาย 1 รายการ ที่จะส่งกลับไปแสดงผลที่ Frontend
type SalesHistoryItemResponse struct {
	ID          uint      `json:"id"`
	OrderNumber string    `json:"order_number"`
	OrderDate   time.Time `json:"order_date"`
	CreatedAt   time.Time `json:"created_at"`

	// พนักงานผู้ขาย/ผู้บันทึกบิล
	CreatedByID   *uint  `json:"created_by_id,omitempty"`
	CreatedByName string `json:"created_by_name"`

	// ลูกค้าในตาราง
	CustomerID   *uint  `json:"customer_id"`
	CustomerName string `json:"customer_name"`
	PhoneNumber  string `json:"phone_number"`

	// ขาจร
	CustomerNameTemp  *string `json:"customer_name_temp"`
	CustomerPhoneTemp *string `json:"customer_phone_temp"`
	CustomerTypeName string `json:"customer_type_name"` 
    Address          string `json:"address"` 

	Subtotal       float64 `json:"subtotal"`
	DiscountAmount float64 `json:"discount_amount"`
	TotalAmount    float64 `json:"total_amount"`
	PaidAmount     float64 `json:"paid_amount"`
	BalanceDue     float64 `json:"balance_due"`

	PaymentMethodName string `json:"payment_method_name"`
	Status            string `json:"status"`
	PaymentStatus     string `json:"payment_status"`

	CancelReason      *string    `json:"cancel_reason"`
	CancelRequestedAt *time.Time `json:"cancel_requested_at"`
	CancelRemark      *string    `json:"cancel_remark"`
	CancelProcessedAt *time.Time `json:"cancel_processed_at"`
	Canceller         string     `json:"canceller"`
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
	var customerName string
	var phoneNumber string
	var customerTypeName string
    var address string
	var customerNameTemp *string
	var customerPhoneTemp *string

	// เช็คว่าเป็นลูกค้าสมาชิกหรือไม่
	if order.CustomerID != nil && order.Customer.ID != 0 {
		// [สมาชิก]
		customerName = order.Customer.CustomerName
		phoneNumber = order.Customer.PhoneNumber
		customerTypeName = order.Customer.CustomerType.TypeLabel // ดึงชื่อประเภทลูกค้าภาษาไทย
		address = order.Customer.ShippingAddress
		customerNameTemp = nil
		customerPhoneTemp = nil
	} else {
		// [ลูกค้าทั่วไป / Walk-in]
		customerName = ""
		phoneNumber = ""
		customerTypeName = "ลูกค้าทั่วไป" // Default ให้ขาจร
		customerNameTemp = order.CustomerNameTemp
		customerPhoneTemp = order.CustomerPhoneTemp
	}

	paymentMethodName := "-"

	// 1. เช็คจาก PaymentMethod ที่ผูกไว้ที่หัวบิลก่อน (ครอบคลุมบิลเงินเชื่อที่ระบุไว้ตอนสร้างออเดอร์)
	if order.PaymentMethod != nil && order.PaymentMethod.MethodName != "" {
		paymentMethodName = order.PaymentMethod.MethodName
	} else if len(order.Payments) > 0 && order.Payments[0].PaymentMethod.MethodName != "" {
		// 2. Fallback: ถ้าที่หัวบิลไม่ได้ลงไว้ ให้ดึงจากรายการชำระเงิน Payment ตัวแรก
		paymentMethodName = order.Payments[0].PaymentMethod.MethodName
	}

	// ดึงชื่อพนักงานขาย/ผู้บันทึกบิล
	createdByName := "-"
	if order.CreatedBy != nil {
		if order.CreatedBy.FirstName != "" || order.CreatedBy.LastName != "" {
			createdByName = strings.TrimSpace(order.CreatedBy.FirstName + " " + order.CreatedBy.LastName)
		} else if order.CreatedBy.Username != "" {
			createdByName = order.CreatedBy.Username
		}
	}

	var canceller string = "-"
	if order.CancelRequestedBy != nil {
		if order.CancelRequestedBy.FirstName != "" || order.CancelRequestedBy.LastName != "" {
			canceller = strings.TrimSpace(order.CancelRequestedBy.FirstName + " " + order.CancelRequestedBy.LastName)
		} else if order.CancelRequestedBy.Username != "" {
			canceller = order.CancelRequestedBy.Username
		}
	}

	return SalesHistoryItemResponse{
		ID:                order.ID,
		OrderNumber:       order.OrderNumber,
		OrderDate:         order.OrderDate,
		CreatedAt:         order.CreatedAt,
		CreatedByID:       &order.CreatedByID,
		CreatedByName:     createdByName,
		CustomerID:        order.CustomerID,
		CustomerName:      customerName,
		PhoneNumber:       phoneNumber,
		CustomerTypeName:   customerTypeName, 
        Address:            address,  
		CustomerNameTemp:  customerNameTemp,
		CustomerPhoneTemp: customerPhoneTemp,
		Subtotal:          order.Subtotal,
		DiscountAmount:    order.DiscountAmount,
		TotalAmount:       order.TotalAmount,
		PaidAmount:        order.PaidAmount,
		BalanceDue:        order.BalanceDue,
		PaymentMethodName: paymentMethodName,
		Status:            string(order.Status),
		PaymentStatus:     string(order.PaymentStatus),
		CancelReason:      order.CancelReason,
		CancelRequestedAt: order.CancelRequestedAt,
		CancelRemark:      order.CancelRemark,
		CancelProcessedAt: order.CancelProcessedAt,
		Canceller:         canceller,
	}
}

func ToSalesHistoryItemResponseList(orders []entity.SaleOrder) []SalesHistoryItemResponse {
	list := []SalesHistoryItemResponse{}
	for _, o := range orders {
		list = append(list, ToSalesHistoryItemResponse(o))
	}
	return list
}

type SaleHistoryItemDetail struct {
	ID                    uint    `json:"id"`
	ProductID             uint    `json:"product_id"`
	PartNumber            string  `json:"part_number"`
	ProductName           string  `json:"product_name"`
	Qty                   int     `json:"qty"`
	Unit                  string  `json:"unit"`
	UnitPrice             float64 `json:"unit_price"`
	DiscountType          string  `json:"discount_type"`
	DiscountValue         float64 `json:"discount_value"`
	DiscountPercent       float64 `json:"discount_percent"`
	DiscountAmount        float64 `json:"discount_amount"`
	FinalUnitPrice        float64 `json:"final_unit_price"`
	Subtotal              float64 `json:"subtotal"`
	AllocatedBillDiscount float64 `json:"allocated_bill_discount"`
	NetSubtotal           float64 `json:"net_subtotal"`
	Note                  string  `json:"note"`
}

// DTO สำหรับตอบกลับภาพรวมทั้งบิลตาม ID
type GetSaleHistoryByIDResponse struct {
	ID          uint      `json:"id"`
	OrderNumber string    `json:"order_number"`
	OrderDate   time.Time `json:"order_date"`

	// พนักงานผู้ขาย/ผู้บันทึกบิล
	CreatedByID   *uint  `json:"created_by_id,omitempty"`
	CreatedByName string `json:"created_by_name"`

	// ลูกค้าในตาราง
	CustomerID   *uint  `json:"customer_id"`
	CustomerName string `json:"customer_name"`
	PhoneNumber  string `json:"phone_number"`

	// ขาจร
	CustomerNameTemp  *string `json:"customer_name_temp"`
	CustomerPhoneTemp *string `json:"customer_phone_temp"`

	CustomerTypeName string `json:"customer_type_name"` 
    Address          string `json:"address"`           

	Subtotal           float64 `json:"subtotal"`             // ยอดรวมก่อนหักส่วนลดบิล
	BillDiscountType   string  `json:"bill_discount_type"`   // ประเภทส่วนลดท้ายบิล (none, amount, percent)
	BillDiscountValue  float64 `json:"bill_discount_value"`  // ส่วนลดท้ายบิล
	DiscountAmount     float64 `json:"discount_amount"`      // มูลค่าส่วนลดท้ายบิล (บาท)
	DiscountPercent    float64 `json:"discount_percent"`     // มูลค่าส่วนลดท้ายบิล (%)
	TotalDiscountItems float64 `json:"total_discount_items"` // เพิ่ม: ผลรวมส่วนลดรายชิ้นสะสมทั้งหมด
	TotalAmount        float64 `json:"total_amount"`         // ยอดเน็ตสุทธิ (Subtotal - DiscountAmount)
	ReceivedAmount     float64 `json:"received_amount"`      // ยอดเงินที่ลูกค้าจ่ายเข้ามา (รวมทุกช่องทาง)
	PaidAmount         float64 `json:"paid_amount"`          // ยอดเงินสุทธิที่หักเงินทอนแล้วและเข้ากระเป๋าร้านจริง (สูงสุดไม่เกิน TotalAmount เช่น 870.00)
	BalanceDue         float64 `json:"balance_due"`          // ยอดคงเหลือที่ลูกค้าต้องจ่ายเพิ่ม (TotalAmount - PaidAmount)
	ChangeAmount       float64 `json:"change_amount"`        // ยอดเงินทอนลูกค้า (PaidAmount - TotalAmount)

	DueDate  *time.Time `json:"due_date"`
	PaidDate *time.Time `json:"paid_date"` // วันที่ลูกค้าจ่ายเงินครบถ้วน (PaidAmount >= TotalAmount) หรือจ่ายเงินบางส่วน (PaidAmount < TotalAmount) แต่ไม่เกิน DueDate
	Note     string     `json:"note"`

	PaymentMethodName string                  `json:"payment_method_name"`
	PaymentStatus     string                  `json:"payment_status"`
	Status            string                  `json:"status"`
	Items             []SaleHistoryItemDetail `json:"items"`

	// ฟิลด์ข้อมูล Cancellation
	CancelReason      *string    `json:"cancel_reason,omitempty"`
	CancelRequestedAt *time.Time `json:"cancel_requested_at,omitempty"`
	CancelRemark      *string    `json:"cancel_remark,omitempty"`
	CancelProcessedAt *time.Time `json:"cancel_processed_at,omitempty"`
	Canceller         string     `json:"canceller,omitempty"`
}

func ToSaleHistoryItemDetail(item entity.SaleOrderItem) SaleHistoryItemDetail {
	return SaleHistoryItemDetail{
		ID:                    item.ID,
		ProductID:             item.ProductID,
		PartNumber:            item.PartNumber,
		ProductName:           item.ProductName,
		Qty:                   item.Qty,
		Unit:                  item.Unit,
		UnitPrice:             item.UnitPrice,
		DiscountType:          string(item.DiscountType),
		DiscountValue:         item.DiscountValue,
		DiscountPercent:       item.DiscountPercent,
		DiscountAmount:        item.DiscountAmount,
		FinalUnitPrice:        item.FinalUnitPrice,
		Subtotal:              item.Subtotal,
		AllocatedBillDiscount: item.AllocatedBillDiscount,
		NetSubtotal:           item.NetSubtotal,
		Note:                  item.Note,
	}
}

// Mapper สำหรับแปลง SaleOrder (entity หลัก) เป็น GetSaleHistoryByIDResponse DTO ฟังก์ชันแปลงข้อมูลสำหรับ หน้าดูรายละเอียดบิลแบบเจาะจง (Detail View by ID)
func ToGetSaleHistoryByIDResponse(order entity.SaleOrder) GetSaleHistoryByIDResponse {
	var customerName string
	var phoneNumber string
	var customerTypeName string
    var address string
	var customerNameTemp *string
	var customerPhoneTemp *string

	// เช็คว่าเป็นลูกค้าสมาชิกหรือไม่
	if order.CustomerID != nil && order.Customer.ID != 0 {
		// [สมาชิก]
		customerName = order.Customer.CustomerName
		phoneNumber = order.Customer.PhoneNumber
		customerTypeName = order.Customer.CustomerType.TypeLabel // 👈 ดึงชื่อประเภทลูกค้าภาษาไทย (หรือใช้ TypeName ก็ได้)
        address = order.Customer.ShippingAddress                // 👈 ดึงที่อยู่จัดส่ง
		customerNameTemp = nil
		customerPhoneTemp = nil
	} else {
		// [ลูกค้าทั่วไป / Walk-in]
		customerName = ""
		phoneNumber = ""
		customerTypeName = "ลูกค้าทั่วไป"
		customerNameTemp = order.CustomerNameTemp
		customerPhoneTemp = order.CustomerPhoneTemp
	}

	// 2. จัดการช่องทางชำระเงิน
	paymentMethodName := "-"
	if order.PaymentMethod != nil && order.PaymentMethod.MethodName != "" {
		paymentMethodName = order.PaymentMethod.MethodName
	} else if len(order.Payments) > 0 {
		if order.Payments[0].PaymentMethod.ID != 0 && order.Payments[0].PaymentMethod.MethodName != "" {
			paymentMethodName = order.Payments[0].PaymentMethod.MethodName
		}
	}

	// 3. ดึงชื่อพนักงานขาย/ผู้บันทึกบิล
	createdByName := "-"
	if order.CreatedBy != nil {
		if order.CreatedBy.FirstName != "" || order.CreatedBy.LastName != "" {
			createdByName = strings.TrimSpace(order.CreatedBy.FirstName + " " + order.CreatedBy.LastName)
		} else if order.CreatedBy.Username != "" {
			createdByName = order.CreatedBy.Username
		}
	}

	// 4. แปลงรายการสินค้า (Items)
	items := make([]SaleHistoryItemDetail, 0, len(order.Items))
	for _, item := range order.Items {
		items = append(items, ToSaleHistoryItemDetail(item))
	}

	var canceller string = "-"
	if order.CancelRequestedBy != nil {
		if order.CancelRequestedBy.FirstName != "" || order.CancelRequestedBy.LastName != "" {
			canceller = strings.TrimSpace(order.CancelRequestedBy.FirstName + " " + order.CancelRequestedBy.LastName)
		} else if order.CancelRequestedBy.Username != "" {
			canceller = order.CancelRequestedBy.Username
		}
	}

	// 5. Return DTO
	return GetSaleHistoryByIDResponse{
		ID:                 order.ID,
		OrderNumber:        order.OrderNumber,
		OrderDate:          order.OrderDate,
		CreatedByID:        &order.CreatedByID,
		CreatedByName:      createdByName,
		CustomerID:         order.CustomerID,
		CustomerName:       customerName,
		PhoneNumber:        phoneNumber,
		CustomerNameTemp:   customerNameTemp,
		CustomerPhoneTemp:  customerPhoneTemp,
		CustomerTypeName:   customerTypeName, 
        Address:            address,          
		Subtotal:           order.Subtotal,
		BillDiscountType:   string(order.BillDiscountType),
		BillDiscountValue:  order.BillDiscountValue,
		DiscountAmount:     order.DiscountAmount,
		DiscountPercent:    order.DiscountPercent,
		TotalDiscountItems: order.TotalDiscountItems,
		TotalAmount:        order.TotalAmount,
		ReceivedAmount:     order.ReceivedAmount,
		PaidAmount:         order.PaidAmount,
		BalanceDue:         order.BalanceDue,
		ChangeAmount:       order.ChangeAmount,
		DueDate:            order.DueDate,
		PaidDate:           order.PaidDate,
		Note:               order.Note,
		PaymentMethodName:  paymentMethodName,
		PaymentStatus:      string(order.PaymentStatus),
		Items:              items,
		Status:             string(order.Status),
		CancelReason:       order.CancelReason,
		CancelRequestedAt:  order.CancelRequestedAt,
		CancelRemark:       order.CancelRemark,
		CancelProcessedAt:  order.CancelProcessedAt,
		Canceller:          canceller,
	}
}
