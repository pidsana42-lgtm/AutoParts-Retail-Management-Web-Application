package pos

import (
	"fmt"
	"time"
	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	posRepository "backend/internal/app/repository/pos"
	"os"
)

type PaymentService interface {
    GeneratePromptPayQR(req posDto.GenerateQRRequest) (*posDto.GenerateQRResponse, error)
    ConfirmPayment(req posDto.ConfirmPaymentRequest) (*posDto.ConfirmPaymentResponse, error)
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

	amount := order.TotalAmount
	refNo := fmt.Sprintf("REF-%s-%d", order.OrderNumber, time.Now().Unix())
	var promptPayMethodID uint = 2 // ID PromptPay

	existingPayment, err := s.paymentRepo.GetPaymentByOrderId(req.OrderID)

	var payment entity.Payment

	if err == nil && existingPayment != nil {
		// ถ้ามี Record อยู่แล้ว -> อัปเดตแถวเดิม (Upsert กันเบิ้ล)
		existingPayment.PaymentMethodID = promptPayMethodID
		existingPayment.Amount = amount
		existingPayment.ReceivedAmount = amount
		existingPayment.ReferenceNumber = refNo

		if err := s.paymentRepo.UpdatePayment(existingPayment); err != nil {
			return nil, fmt.Errorf("อัปเดตข้อมูลการชำระเงินล้มเหลว: %v", err)
		}
		payment = *existingPayment
	} else {
		// ถ้ายังไม่มี -> สร้าง Record ใหม่
		payment = entity.Payment{
			OrderID:         req.OrderID,
			PaymentMethodID: promptPayMethodID,
			Amount:          amount,
			ReceivedAmount:  amount,
			ChangeAmount:    0.00,
			ReferenceNumber: refNo,
			TransactionRef:  nil,
			ReceivedByID:    req.ReceivedByID,
			PaidAt:          nil,
		}

		if err := s.paymentRepo.CreatePayment(&payment); err != nil {
			return nil, fmt.Errorf("ไม่สามารถบันทึกข้อมูลการชำระเงินได้: %v", err)
		}
	}

	// 5. Gen QR Code
	merchantPromptPayNo := os.Getenv("PromptPayNo") // เบอร์พร้อมเพย์ร้าน
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

func (s *paymentService) ConfirmPayment(req posDto.ConfirmPaymentRequest) (*posDto.ConfirmPaymentResponse, error) {
	tx := s.paymentRepo.BeginTransaction()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	order, err := s.paymentRepo.GetOrderById(req.OrderID)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("ไม่พบออเดอร์ที่เกี่ยวข้อง: %v", err)
	}

    
    if req.PaymentMethodID > 0 {
        order.PaymentMethodID = &req.PaymentMethodID
    }

	// ---------------------------------------------------------------------
	// เคสที่ 1: ชำระด้วย "เงินเชื่อ" (CREDIT - PaymentMethodID == 3)
	// ---------------------------------------------------------------------
	if req.PaymentMethodID == 3 {
		// เปลี่ยนสถานะการขายเป็น completed แต่ payment_status ยังคงเป็น unpaid
		order.Status = "completed"
		order.PaymentStatus = "unpaid" // ยังไม่จ่าย
		order.ReceivedAmount = 0.00
		order.PaidAmount = 0.00
		order.BalanceDue = order.TotalAmount // ยอดค้างชำระเท่ากับยอดรวมบิล
		order.ChangeAmount = 0.00

        if err := s.paymentRepo.UpdateOrderWithTx(tx, order); err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("อัปเดตสถานะออเดอร์เงินเชื่อล้มเหลว: %v", err)
        }

        // หากเคยสร้าง Record ใน payments ไว้ (เช่น กดดู QR Code ก่อนสลับมาเงินเชื่อ) 
        // ให้อัปเดต PaymentMethodID ให้ตรงกันด้วย
        existingPayment, err := s.paymentRepo.GetPaymentByOrderId(req.OrderID)
        if err == nil && existingPayment != nil {
            existingPayment.PaymentMethodID = req.PaymentMethodID
            _ = s.paymentRepo.UpdatePaymentWithTx(tx, existingPayment)
        }

        if err := tx.Commit().Error; err != nil {
            tx.Rollback()
            return nil, fmt.Errorf("Commit Transaction ล้มเหลว: %v", err)
        }

		return &posDto.ConfirmPaymentResponse{
			Message: "บันทึกรายการขายเชื่อสำเร็จ",
			OrderID: order.ID,
			PaidAt:  time.Now(),
		}, nil
	}

	// ---------------------------------------------------------------------
	// เคสที่ 2: ชำระด้วย "เงินสด / QR Code" (PaymentMethodID 1 หรือ 2)
	// ---------------------------------------------------------------------
	var payment *entity.Payment

	if req.PaymentID > 0 {
		payment, err = s.paymentRepo.GetPaymentByID(req.PaymentID)
		if err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("ไม่พบรายการชำระเงิน")
		}
	} else {
		existingPayment, err := s.paymentRepo.GetPaymentByOrderId(req.OrderID)
		if err == nil && existingPayment != nil {
			payment = existingPayment
		} else {
			newPayment := entity.Payment{
				OrderID:         req.OrderID,
				PaymentMethodID: req.PaymentMethodID,
				Amount:          order.TotalAmount,
				ReceivedAmount:  req.ReceivedAmount,
				ChangeAmount:    req.ReceivedAmount - order.TotalAmount,
				ReferenceNumber: fmt.Sprintf("PAY-%s-%d", order.OrderNumber, time.Now().Unix()),
				ReceivedByID:    req.ReceivedByID,
			}
			if newPayment.ChangeAmount < 0 {
				newPayment.ChangeAmount = 0
			}

			if err := s.paymentRepo.CreatePaymentWithTx(tx, &newPayment); err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("สร้างรายการชำระเงินล้มเหลว: %v", err)
			}
			payment = &newPayment
		}
	}

    if payment.PaidAt != nil {
        tx.Rollback()
        return nil, fmt.Errorf("รายการชำระเงินนี้ได้รับการยืนยันไปแล้ว")
    }

    // บังคับอัปเดต PaymentMethodID ของ Payment Record เป็นวิธีชำระเงินล่าสุดเสมอ
    if req.PaymentMethodID > 0 {
        payment.PaymentMethodID = req.PaymentMethodID
    }

	now := time.Now()
	payment.PaidAt = &now
	if req.ReceivedAmount > 0 {
		payment.ReceivedAmount = req.ReceivedAmount
		if req.ReceivedAmount > payment.Amount {
			payment.ChangeAmount = req.ReceivedAmount - payment.Amount
		}
	}

	if err := s.paymentRepo.UpdatePaymentWithTx(tx, payment); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("อัปเดตสถานะการชำระเงินล้มเหลว: %v", err)
	}

	// อัปเดตสถานะ Order ให้เป็น paid สำหรับเงินสด/QR Code
	order.Status = "completed"
	order.PaymentStatus = "paid"
	order.PaidAmount = order.TotalAmount
	order.ReceivedAmount = payment.ReceivedAmount
	order.ChangeAmount = payment.ChangeAmount
	order.BalanceDue = 0.00

	if err := s.paymentRepo.UpdateOrderWithTx(tx, order); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("อัปเดตสถานะออเดอร์ล้มเหลว: %v", err)
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("Commit Transaction ล้มเหลว: %v", err)
	}

	return &posDto.ConfirmPaymentResponse{
		Message:   "ยืนยันการชำระเงินสำเร็จ",
		PaymentID: payment.ID,
		OrderID:   payment.OrderID,
		PaidAt:    now,
	}, nil
}