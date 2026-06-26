package enum

type PaymentMethodName string

const (
    PaymentMethodCash   = "เงินสด"
    PaymentMethodQR     = "เงินโอน/สแกน QR"
    PaymentMethodCredit = "เงินเชื่อ" 
)