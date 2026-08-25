package pos

import "time"

type GenerateQRRequest struct {
	OrderID      uint `json:"order_id"`
	ReceivedByID uint `json:"received_by_id"`
}

type GenerateSettleQRRequest struct {
	Amount       float64 `json:"amount" binding:"required,gt=0"`
	CustomerID   *uint   `json:"customer_id"`
	ReceivedByID uint    `json:"received_by_id"`
}

type GenerateQRResponse struct {
	Status          string    `json:"status"`
	PaymentID       uint      `json:"payment_id,omitempty"`
	OrderID         uint      `json:"order_id,omitempty"`
	Amount          float64   `json:"amount"`
	QRCode          string    `json:"qr_code"`
	ReferenceNumber string    `json:"reference_number"`
	TransactionRef  *string   `json:"transaction_ref,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type ConfirmPaymentRequest struct {
	PaymentID       uint    `json:"payment_id"`
	OrderID         uint    `json:"order_id"`
	PaymentMethodID uint    `json:"payment_method_id"`
	ReceivedAmount  float64 `json:"received_amount"`
	ReceivedByID    uint    `json:"received_by_id"`
}

type ConfirmPaymentResponse struct {
	Message   string    `json:"message"`
	PaymentID uint      `json:"payment_id"`
	OrderID   uint      `json:"order_id"`
	PaidAt    time.Time `json:"paid_at"`
}

type UnpaidBillItem struct {
	OrderID       uint      `json:"order_id"`
	OrderNumber   string    `json:"order_number"`
	OrderDate     time.Time `json:"order_date"`
	TotalAmount   float64   `json:"total_amount"`
	PaidAmount    float64   `json:"paid_amount"`
	BalanceDue    float64   `json:"balance_due"`
	PaymentStatus string    `json:"payment_status"` // unpaid, partial
	PhoneNumber   string    `json:"phone_number"`
	CustomerType  string    `json:"customer_type"`
}

type CustomerUnpaidBillsResponse struct {
	CustomerID   uint             `json:"customer_id"`
	CustomerName string           `json:"customer_name"`
	TotalDebt    float64          `json:"total_debt"`
	Bills        []UnpaidBillItem `json:"bills"`
}

// DTO สำหรับบันทึกเคลียร์บิล
type SettleBillAllocation struct {
	OrderID   uint    `json:"order_id" binding:"required"`
	PayAmount float64 `json:"pay_amount" binding:"required,gt=0"`
}

type SettleBillsRequest struct {
	CustomerID      uint                   `json:"customer_id" binding:"required"`
	ReceivedByID    uint                   `json:"received_by_id" binding:"required"`
	PaymentMethodID uint                   `json:"payment_method_id" binding:"required"`
	TotalReceived   float64                `json:"total_received" binding:"required,gt=0"`
	TransactionRef  *string                `json:"transaction_ref"`
	Allocations     []SettleBillAllocation `json:"allocations" binding:"required,min=1"`
}

type SettleBillsResponse struct {
	ReceiptID         uint      `json:"receipt_id"`
	ReceiptNumber     string    `json:"receipt_number"`
	CustomerID        uint      `json:"customer_id"`
	CustomerName      string    `json:"customer_name"`
	TotalReceived     float64   `json:"total_received"`
	SettledBillsCount int       `json:"settled_bills_count"`
	ReceivedByID      uint      `json:"received_by_id"`
	ReceivedByName    string    `json:"received_by_name"`
	PaidAt            time.Time `json:"paid_at"`
}

// DTO สำหรับประวัติการรับชำระเงิน
type PaymentHistoryItem struct {
	ReceiptID             uint       `json:"receipt_id"`
	ReceiptNumber         string     `json:"receipt_number"`
	PaidAt                time.Time  `json:"paid_at"`
	CustomerName          string     `json:"customer_name"`
	PaymentMethod         string     `json:"payment_method"`
	OrderNumbers          string     `json:"order_numbers"` // รวมเลขบิล เช่น "INV-001, INV-002"
	TotalReceived         float64    `json:"total_received"`
	Status                string     `json:"status"` // completed, pending_cancel, cancelled
	ReceivedByID          uint       `json:"received_by_id"`
	ReceivedByName        string     `json:"received_by_name"`
	PaymentType           string     `json:"payment_type,omitempty"`
	CancelReason          string     `json:"cancel_reason,omitempty"`
	CancelRequestedByID   *uint      `json:"cancel_requested_by_id,omitempty"`
	CancelRequestedByName string     `json:"cancel_requested_by_name,omitempty"`
	CancelRequestedAt     *time.Time `json:"cancel_requested_at,omitempty"`
	CancelRemark          string     `json:"cancel_remark,omitempty"`
}

// DTO สำหรับพนักงานส่งคำขอยกเลิกใบเสร็จ (Request Cancel Payment Receipt)
type RequestCancelPaymentReceiptRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// DTO สำหรับเจ้าของร้านอนุมัติ/ปฏิเสธคำขอยกเลิก (Process Cancel Payment Receipt)
type ProcessCancelPaymentReceiptRequest struct {
	Remark string `json:"remark"`
}

// DTO สำหรับยกเลิกการชำระเงิน (Cancel Payment)
type CancelPaymentReceiptRequest struct {
	CancelledByID uint   `json:"cancelled_by_id" binding:"required"`
	Reason        string `json:"reason" binding:"required"`
	PaymentType   string `json:"payment_type,omitempty"`
}

type CancelledPaymentItem struct {
	ReceiptID       uint       `json:"receipt_id"`
	ReceiptNumber   string     `json:"receipt_number"`
	OriginalPaidAt  time.Time  `json:"original_paid_at"`
	CustomerName    string     `json:"customer_name"`
	TotalAmount     float64    `json:"total_amount"`
	CancelledAt     *time.Time `json:"cancelled_at"`
	CancelledByName string     `json:"cancelled_by_name"`
	CancelReason    string     `json:"cancel_reason"`
}