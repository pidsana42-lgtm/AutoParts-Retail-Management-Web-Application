package pos

import "time"

type GenerateQRRequest struct {
	OrderID      uint `json:"order_id" binding:"required"`
	ReceivedByID uint `json:"received_by_id" binding:"required"`
}

type GenerateQRResponse struct {
	Status          string    `json:"status"`
	PaymentID       uint      `json:"payment_id"`
	OrderID         uint      `json:"order_id"`
	Amount          float64   `json:"amount"`
	QRCode          string    `json:"qr_code"`
	ReferenceNumber string    `json:"reference_number"`
	TransactionRef  *string   `json:"transaction_ref"`
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