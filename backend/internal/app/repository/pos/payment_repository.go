package pos

import (
	"encoding/base64"
	"fmt"
	"backend/internal/app/entity"

	"github.com/skip2/go-qrcode"
	"gorm.io/gorm"
)

type PaymentRepository interface {
	GetOrderById(orderID uint) (*entity.SaleOrder, error)
	GetPaymentByOrderId(orderID uint) (*entity.Payment, error)
	GetPaymentByID(paymentID uint) (*entity.Payment, error)
	CreatePayment(payment *entity.Payment) error
	CreatePaymentWithTx(tx *gorm.DB, payment *entity.Payment) error 
	UpdatePayment(payment *entity.Payment) error
	UpdatePaymentWithTx(tx *gorm.DB, payment *entity.Payment) error
	UpdateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error
	GeneratePromptPayQR(promptPayNo string, amount float64) (string, error)
	BeginTransaction() *gorm.DB
}

type paymentRepository struct {
	db *gorm.DB
}

func NewPaymentRepository(db *gorm.DB) PaymentRepository {
	return &paymentRepository{db: db}
}

func (r *paymentRepository) GetOrderById(orderID uint) (*entity.SaleOrder, error) {
	var order entity.SaleOrder
	err := r.db.First(&order, orderID).Error
	return &order, err
}

func (r *paymentRepository) GetPaymentByOrderId(orderID uint) (*entity.Payment, error) {
	var payment entity.Payment
	err := r.db.Where("order_id = ?", orderID).First(&payment).Error
	return &payment, err
}

func (r *paymentRepository) GetPaymentByID(paymentID uint) (*entity.Payment, error) {
	var payment entity.Payment
	err := r.db.First(&payment, paymentID).Error
	return &payment, err
}

func (r *paymentRepository) CreatePayment(payment *entity.Payment) error {
	return r.db.Create(payment).Error
}

func (r *paymentRepository) UpdatePayment(payment *entity.Payment) error {
	return r.db.Save(payment).Error
}

func (r *paymentRepository) CreatePaymentWithTx(tx *gorm.DB, payment *entity.Payment) error {
	return tx.Create(payment).Error
}

func (r *paymentRepository) UpdatePaymentWithTx(tx *gorm.DB, payment *entity.Payment) error {
	return tx.Save(payment).Error
}

func (r *paymentRepository) UpdateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error {
	return tx.Save(order).Error
}

func (r *paymentRepository) BeginTransaction() *gorm.DB {
	return r.db.Begin()
}

func (r *paymentRepository) calculateCRC16(input string) string {
	crc := uint16(0xFFFF)
	data := []byte(input)
	for _, b := range data {
		crc ^= uint16(b) << 8
		for i := 0; i < 8; i++ {
			if (crc & 0x8000) != 0 {
				crc = (crc << 1) ^ 0x1021
			} else {
				crc <<= 1
			}
		}
	}
	return fmt.Sprintf("%04X", crc)
}

// ฟังก์ชันนี้ทำหน้าที่แปลง เบอร์โทรศัพท์/เลขบัตรประชาชน และ ยอดเงิน ให้กลายเป็น PromptPay QR Code (EMVCo Format) ในรูปแบบ Data URI (Base64 PNG) เพื่อส่งให้หน้าบ้านนำไปแสดงผลได้ทันที
func (r *paymentRepository) GeneratePromptPayQR(target string, amount float64) (string, error) {
	formattedTarget := target
	targetType := "01"

	if len(target) == 10 && target[0] == '0' {
		formattedTarget = "0066" + target[1:]
	} else if len(target) > 10 {
		targetType = "02"
	}

	targetLength := fmt.Sprintf("%02d", len(formattedTarget))
	amountStr := fmt.Sprintf("%.2f", amount)
	amountLength := fmt.Sprintf("%02d", len(amountStr))

	payload := "00020101021229370016A000000677010111" +
		targetType + targetLength + formattedTarget +
		"5802TH5303764" +
		"54" + amountLength + amountStr +
		"6304"

	fullPayload := payload + r.calculateCRC16(payload)

	pngData, err := qrcode.Encode(fullPayload, qrcode.Medium, 256)
	if err != nil {
		return "", err
	}

	encoded := base64.StdEncoding.EncodeToString(pngData)
	return fmt.Sprintf("data:image/png;base64,%s", encoded), nil
}