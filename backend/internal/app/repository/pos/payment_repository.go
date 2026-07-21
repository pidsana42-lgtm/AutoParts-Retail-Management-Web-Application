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
	CreatePayment(payment *entity.Payment) error
	GeneratePromptPayQR(promptPayNo string, amount float64) (string, error)
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

func (r *paymentRepository) CreatePayment(payment *entity.Payment) error {
	return r.db.Create(payment).Error
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