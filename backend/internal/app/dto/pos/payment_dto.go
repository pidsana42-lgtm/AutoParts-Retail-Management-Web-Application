package pos

import "time"

type GenerateQRRequest struct {
	OrderID      uint `json:"order_id" binding:"required"`
	ReceivedByID uint `json:"received_by_id" binding:"required"`
}

type GenerateQRResponse struct {
	Status          string     `json:"status"`
	PaymentID       uint       `json:"payment_id"`
	OrderID         uint       `json:"order_id"`
	Amount          float64    `json:"amount"`
	QRCode          string     `json:"qr_code"`
	ReferenceNumber string     `json:"reference_number"`
	TransactionRef  *string    `json:"transaction_ref"`
	CreatedAt       time.Time  `json:"created_at"`
}