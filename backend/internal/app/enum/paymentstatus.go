package enum

type PaymentStatus string

const (
	PaymentPaid    PaymentStatus = "paid"
	PaymentUnpaid  PaymentStatus = "unpaid"
	PaymentPartial PaymentStatus = "partial"
)