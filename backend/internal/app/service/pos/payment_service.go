package pos

import (
	"fmt"
	"time"
	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	posRepository "backend/internal/app/repository/pos"
)

type PaymentService interface {
	GeneratePromptPayQR(req posDto.GenerateQRRequest) (*posDto.GenerateQRResponse, error)
}

type paymentService struct {
	paymentRepo posRepository.PaymentRepository
}

func NewPaymentService(paymentRepo posRepository.PaymentRepository) PaymentService {
	return &paymentService{paymentRepo: paymentRepo}
}

func (s *paymentService) GeneratePromptPayQR(req posDto.GenerateQRRequest) (*posDto.GenerateQRResponse, error) {
	// 1. ดึงข้อมูล Order เพื่อเอายอดเงินจริง
	order, err := s.paymentRepo.GetOrderById(req.OrderID)
	if err != nil {
		return nil, fmt.Errorf("ไม่พบรายการสั่งซื้อ: %v", err)
	}

	// 📌 สมมติว่ายอดเงินรวมอยู่ใน order.TotalAmount (ปรับตาม field จริงของ SaleOrder ได้ครับ)
	amount := order.TotalAmount 

	// 2. สร้าง Reference Number สำหรับอ้างอิงธุรกรรม (เช่น REF-ORDERID-TIMESTAMP)
	refNo := fmt.Sprintf("REF-%d-%d", req.OrderID, time.Now().Unix())

	// 3. กำหนด ID ของ PaymentMethod สำหรับ PromptPay (สมมติว่าเป็น ID 2)
	var promptPayMethodID uint = 2 

	// 4. บันทึก Record การชำระเงินลง DB (สเตตัสรอยืนยัน PaidAt ยังเป็น nil)
	payment := entity.Payment{
		OrderID:         req.OrderID,
		PaymentMethodID: promptPayMethodID,
		Amount:          amount,
		ReceivedAmount:  amount, // สำหรับ QR Code ยอดรับจะเท่ากับยอดชำระพอดี
		ChangeAmount:    0.00,   // ไม่มีการเงินทอน
		ReferenceNumber: refNo,
		ReceivedByID:    req.ReceivedByID,
		PaidAt:          nil,    // ยังไม่อัปเดตเวลาจ่าย จนกว่า Webhook ตรวจสลิปผ่าน
	}

	if err := s.paymentRepo.CreatePayment(&payment); err != nil {
		return nil, fmt.Errorf("ไม่สามารถบันทึกข้อมูลการชำระเงินได้: %v", err)
	}

	// 5. Gen QR Code
	merchantPromptPayNo := "0967985115" // เบอร์พร้อมเพย์ร้าน
	qrBase64, err := s.paymentRepo.GeneratePromptPayQR(merchantPromptPayNo, amount)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถสร้าง QR Code ได้: %v", err)
	}

	// 6. ส่ง Response กลับ
	return &posDto.GenerateQRResponse{
		Status:          "pending",
		PaymentID:       payment.ID,
		OrderID:         payment.OrderID,
		Amount:          payment.Amount,
		QRCode:          qrBase64,
		ReferenceNumber: refNo,
		CreatedAt:       payment.CreatedAt,
	}, nil
}