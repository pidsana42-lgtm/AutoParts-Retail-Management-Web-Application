package pos

import (
	"context"
	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	posRepository "backend/internal/app/repository/pos"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
	"time"
	svcNotification "backend/internal/app/service/notification"
)

type PaymentService interface {
	GeneratePromptPayQR(req posDto.GenerateQRRequest) (*posDto.GenerateQRResponse, error)
	GenerateSettleQR(req posDto.GenerateSettleQRRequest) (*posDto.GenerateQRResponse, error)
	ConfirmPayment(req posDto.ConfirmPaymentRequest) (*posDto.ConfirmPaymentResponse, error)

	GetUnpaidBillsByCustomer(customerID uint) (*posDto.CustomerUnpaidBillsResponse, error)
	GetUnpaidBillByOrderNumber(orderNumber string) (*posDto.CustomerUnpaidBillsResponse, error)
	SettleCustomerBills(req posDto.SettleBillsRequest) (*posDto.SettleBillsResponse, error)
	GetPaymentHistory(search, startDate, endDate string, employeeID uint) ([]posDto.PaymentHistoryItem, error)
	GetPaymentHistoryByID(receiptID uint) (*posDto.PaymentHistoryItem, error)
	GetCancelledPaymentHistory(search, startDate, endDate string) ([]posDto.CancelledPaymentItem, error)
	RequestCancelPaymentReceipt(repaymentID uint, userID uint, reason string) error
	RevertCancelPaymentReceiptRequest(repaymentID uint, userID uint, isOwnerOrAdmin bool) error
	ApproveCancelPaymentReceipt(repaymentID uint, ownerID uint, remark string) error
	RejectCancelPaymentReceipt(repaymentID uint, remark string) error
	CancelPaymentReceipt(repaymentID uint, req posDto.CancelPaymentReceiptRequest) error
	GenerateDebtRepaymentReceiptPDF(ctx context.Context, identifier string) ([]byte, error)
	GenerateCustomerStatementPDF(ctx context.Context, customerID uint, startDate, endDate string) ([]byte, error)
}

type paymentService struct {
	paymentRepo  posRepository.PaymentRepository
	notification svcNotification.NotificationService
}

func NewPaymentService(paymentRepo posRepository.PaymentRepository, notification svcNotification.NotificationService) PaymentService {
	return &paymentService{paymentRepo: paymentRepo, notification: notification}
}

// -------------------------------------------------------------
// 1. กระบวนการชำระเงินหน้าร้าน & PromptPay QR
// -------------------------------------------------------------
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
	// if merchantPromptPayNo == "" {
	// 	merchantPromptPayNo = "0812345678"
	// }
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

func (s *paymentService) GenerateSettleQR(req posDto.GenerateSettleQRRequest) (*posDto.GenerateQRResponse, error) {
	if req.Amount <= 0 {
		return nil, errors.New("ยอดเงินต้องมากกว่า 0 บาท")
	}

	merchantPromptPayNo := os.Getenv("PromptPayNo")
	// if merchantPromptPayNo == "" {
	// 	merchantPromptPayNo = "0812345678"
	// }

	qrBase64, err := s.paymentRepo.GeneratePromptPayQR(merchantPromptPayNo, req.Amount)
	if err != nil {
		return nil, fmt.Errorf("ไม่สามารถสร้าง QR Code ได้: %v", err)
	}

	refNo := fmt.Sprintf("REF-SETTLE-%d", time.Now().Unix())

	return &posDto.GenerateQRResponse{
		Status:          "pending",
		Amount:          req.Amount,
		QRCode:          qrBase64,
		ReferenceNumber: refNo,
		CreatedAt:       time.Now(),
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
		if order.CustomerID == nil {
			tx.Rollback()
			return nil, errors.New("ลูกค้าทั่วไป/ขาจร ไม่สามารถเลือกชำระแบบซื้อเชื่อได้")
		}

		var customer entity.Customer
		if err := tx.First(&customer, *order.CustomerID).Error; err != nil {
			tx.Rollback()
			return nil, errors.New("ไม่พบข้อมูลลูกค้าในระบบ")
		}

		// หากออเดอร์ก่อนหน้านี้ยังไม่ได้บันทึกหนี้ (เช่น ออเดอร์สถานะ pending)
		if order.Status == "pending" || order.PaymentStatus != "unpaid" {
			if customer.CurrentDebtAmount+order.TotalAmount > customer.CreditLimit {
				tx.Rollback()
				return nil, fmt.Errorf("วงเงินเครดิตไม่เพียงพอ! วงเงินคงเหลือขาดไป %.2f บาท", (customer.CurrentDebtAmount+order.TotalAmount)-customer.CreditLimit)
			}
			customer.CurrentDebtAmount += order.TotalAmount
			if err := tx.Save(&customer).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("อัปเดตยอดหนี้สะสมล้มเหลว: %v", err)
			}
		}

		if order.DueDate == nil {
			storeConfig, err := s.paymentRepo.GetStoreConfig()
			now := time.Now()
			maxDays := 30
			if err == nil && storeConfig != nil && storeConfig.MaxOverdueDays > 0 {
				maxDays = storeConfig.MaxOverdueDays
			}
			dueDate := now.AddDate(0, 0, maxDays)
			order.DueDate = &dueDate
		}

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

	if req.ReceivedByID > 0 {
		payment.ReceivedByID = req.ReceivedByID
	} else if payment.ReceivedByID == 0 {
		payment.ReceivedByID = order.CreatedByID
	}

	// บังคับอัปเดต PaymentMethodID ของ Payment Record เป็นวิธีชำระเงินล่าสุดเสมอ
	if req.PaymentMethodID > 0 {
		payment.PaymentMethodID = req.PaymentMethodID
	}

	now := time.Now()
	if payment.PaidAt == nil {
		payment.PaidAt = &now
	}
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

// -------------------------------------------------------------
// 2. ดึงรายการบิลค้างชำระของลูกค้า (Unpaid Orders) GET /api/pos/payments/unpaid-bills/:customer_id
// -------------------------------------------------------------
func (s *paymentService) GetUnpaidBillsByCustomer(customerID uint) (*posDto.CustomerUnpaidBillsResponse, error) {
	// 1. ดึงข้อมูลลูกค้าโดยตรงจากฐานข้อมูล
	var customer entity.Customer
	customerName := ""
	if err := s.paymentRepo.BeginTransaction().First(&customer, customerID).Error; err == nil {
		customerName = customer.CustomerName
	}

	// 2. ดึงรายการบิล
	orders, err := s.paymentRepo.GetUnpaidOrdersByCustomerID(customerID)
	if err != nil {
		return nil, err
	}

	var totalDebt float64
	billItems := make([]posDto.UnpaidBillItem, 0)

	for _, o := range orders {
		if customerName == "" {
			if o.Customer.ID != 0 && o.Customer.CustomerName != "" {
				customerName = o.Customer.CustomerName
			} else if o.CustomerNameTemp != nil {
				customerName = *o.CustomerNameTemp
			}
		}

		// ดึงเบอร์โทรศัพท์
		phone := ""
		if o.Customer.ID != 0 && o.Customer.PhoneNumber != "" {
			phone = o.Customer.PhoneNumber
		} else if o.CustomerPhoneTemp != nil {
			phone = *o.CustomerPhoneTemp
		}

		// ดึงประเภทลูกค้า
		customerType := ""
		if o.Customer.CustomerType.ID != 0 {
			customerType = o.Customer.CustomerType.TypeLabel
		}

		totalDebt += o.BalanceDue
		billItems = append(billItems, posDto.UnpaidBillItem{
			OrderID:       o.ID,
			OrderNumber:   o.OrderNumber,
			OrderDate:     o.CreatedAt,
			TotalAmount:   o.TotalAmount,
			PaidAmount:    o.PaidAmount,
			BalanceDue:    o.BalanceDue,
			PaymentStatus: string(o.PaymentStatus),
			PhoneNumber:   phone,        // เพิ่มฟิลด์นี้
			CustomerType:  customerType, // เพิ่มฟิลด์นี้
		})
	}

	return &posDto.CustomerUnpaidBillsResponse{
		CustomerID:   customerID,
		CustomerName: customerName,
		TotalDebt:    totalDebt,
		Bills:        billItems,
	}, nil
}

func (s *paymentService) GetUnpaidBillByOrderNumber(orderNumber string) (*posDto.CustomerUnpaidBillsResponse, error) {
	order, err := s.paymentRepo.GetUnpaidOrderByOrderNumber(orderNumber)
	if err != nil {
		// เช็คกรณีพิเศษเพื่อแจ้งเตือนให้ผู้ใช้เข้าใจชัดเจน
		var anyOrder entity.SaleOrder
		if errCheck := s.paymentRepo.BeginTransaction().Where("order_number = ?", orderNumber).First(&anyOrder).Error; errCheck == nil {
			if anyOrder.Status == "cancelled" || anyOrder.Status == "pending_cancel" {
				return nil, errors.New("บิลนี้ถูกยกเลิกแล้ว ไม่สามารถทำรายการได้")
			}
			if anyOrder.PaymentStatus == "paid" || anyOrder.BalanceDue <= 0 {
				return nil, errors.New("บิลนี้ชำระเงินครบถ้วนแล้ว ไม่มียอดค้างชำระ")
			}
		}
		return nil, fmt.Errorf("ไม่พบบิลเลขที่ %s หรือบิลนี้ไม่มียอดค้างชำระ", orderNumber)
	}

	customerID := uint(0)
	customerName := ""
	if order.CustomerID != nil {
		customerID = *order.CustomerID
	}
	if order.Customer.ID != 0 && order.Customer.CustomerName != "" {
		customerName = order.Customer.CustomerName
	} else if order.CustomerNameTemp != nil {
		customerName = *order.CustomerNameTemp
	}

	phone := ""
	if order.Customer.ID != 0 && order.Customer.PhoneNumber != "" {
		phone = order.Customer.PhoneNumber
	} else if order.CustomerPhoneTemp != nil {
		phone = *order.CustomerPhoneTemp
	}

	customerType := ""
	if order.Customer.CustomerType.ID != 0 {
		customerType = order.Customer.CustomerType.TypeLabel
	}

	billItem := posDto.UnpaidBillItem{
		OrderID:       order.ID,
		OrderNumber:   order.OrderNumber,
		OrderDate:     order.CreatedAt,
		TotalAmount:   order.TotalAmount,
		PaidAmount:    order.PaidAmount,
		BalanceDue:    order.BalanceDue,
		PaymentStatus: string(order.PaymentStatus),
		PhoneNumber:   phone,
		CustomerType:  customerType,
	}

	return &posDto.CustomerUnpaidBillsResponse{
		CustomerID:   customerID,
		CustomerName: customerName,
		TotalDebt:    order.BalanceDue,
		Bills:        []posDto.UnpaidBillItem{billItem},
	}, nil
}

// -------------------------------------------------------------
// 3. เคลียร์บิลเงินเชื่อ (บันทึก PaymentRepayment + ตัดยอดหนี้)
// -------------------------------------------------------------
func (s *paymentService) SettleCustomerBills(req posDto.SettleBillsRequest) (*posDto.SettleBillsResponse, error) {
	tx := s.paymentRepo.BeginTransaction()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	now := time.Now()
	var lastRepaymentID uint
	var lastReceiptNo string // ประกาศตัวแปรเก็บเลขที่ใบเสร็จสำหรับส่งกลับ response

	for _, alloc := range req.Allocations {
		order, err := s.paymentRepo.GetOrderById(alloc.OrderID)
		if err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("ไม่พบบิลเลขที่ %d", alloc.OrderID)
		}

		if alloc.PayAmount <= 0 {
			tx.Rollback()
			return nil, fmt.Errorf("ยอดชำระของบิล %s ต้องมากกว่า 0 บาท", order.OrderNumber)
		}

		if alloc.PayAmount > order.BalanceDue {
			tx.Rollback()
			return nil, fmt.Errorf("ยอดชำระของบิล %s (%.2f บาท) เกินยอดค้างชำระ (%.2f บาท)", order.OrderNumber, alloc.PayAmount, order.BalanceDue)
		}

		// ย้ายมาสร้างตรงนี้เพื่อให้มีตัวแปร order ให้ใช้งาน
		receiptNo := fmt.Sprintf("RE-%s-%d", strings.TrimPrefix(order.OrderNumber, "INV"), now.Unix())
		lastReceiptNo = receiptNo

		repayment := entity.PaymentRepayment{
			ReceiptNumber:   receiptNo,
			OrderID:         order.ID,
			PaymentMethodID: req.PaymentMethodID,
			AmountPaid:      alloc.PayAmount,
			PaidAt:          &now,
			RecordedByID:    req.ReceivedByID,
			Status:          "completed",
		}

		if err := s.paymentRepo.CreateRepaymentWithTx(tx, &repayment); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("สร้างรายการรับชำระล้มเหลว: %v", err)
		}
		lastRepaymentID = repayment.ID

		order.PaidAmount += alloc.PayAmount
		order.BalanceDue = order.TotalAmount - order.PaidAmount

		if order.BalanceDue <= 0 {
			order.BalanceDue = 0
			order.PaymentStatus = "paid"
		} else {
			order.PaymentStatus = "partial"
		}

		if err := s.paymentRepo.UpdateOrderWithTx(tx, order); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("อัปเดตยอดคงค้างบิลล้มเหลว: %v", err)
		}

		// หักลดยอดหนี้คงค้างของลูกค้าลง
		if order.CustomerID != nil {
			var cust entity.Customer
			if err := tx.First(&cust, *order.CustomerID).Error; err == nil {
				if cust.CurrentDebtAmount >= alloc.PayAmount {
					cust.CurrentDebtAmount -= alloc.PayAmount
				} else {
					cust.CurrentDebtAmount = 0
				}
				if err := tx.Save(&cust).Error; err != nil {
					tx.Rollback()
					return nil, fmt.Errorf("อัปเดตยอดหนี้สะสมลูกค้าล้มเหลว: %v", err)
				}
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return nil, err
	}

    createdRepayment, err := s.paymentRepo.GetRepaymentByID(lastRepaymentID)
    
    staffName := ""
    customerName := ""

    if err == nil && createdRepayment != nil {
        // ดึงชื่อพนักงานผู้รับเงิน
        if createdRepayment.RecordedBy.FirstName != "" || createdRepayment.RecordedBy.LastName != "" {
            staffName = strings.TrimSpace(createdRepayment.RecordedBy.FirstName + " " + createdRepayment.RecordedBy.LastName)
        } else {
            staffName = createdRepayment.RecordedBy.Username
        }

        // ดึงชื่อลูกค้า
        if createdRepayment.Order.Customer.ID != 0 && createdRepayment.Order.Customer.CustomerName != "" {
            customerName = createdRepayment.Order.Customer.CustomerName
        } else if createdRepayment.Order.CustomerNameTemp != nil {
            customerName = *createdRepayment.Order.CustomerNameTemp
        }
    }

    return &posDto.SettleBillsResponse{
        ReceiptID:         lastRepaymentID,
        ReceiptNumber:     lastReceiptNo,
        CustomerID:        req.CustomerID,
        CustomerName:      customerName,
        TotalReceived:     req.TotalReceived,
        SettledBillsCount: len(req.Allocations),
        ReceivedByID:      req.ReceivedByID,
        ReceivedByName:    staffName, 
        PaidAt:            now,
    }, nil
}

// -------------------------------------------------------------
// 4. ประวัติการรับชำระเงิน (Payment History)
// -------------------------------------------------------------
func (s *paymentService) GetPaymentHistory(search, startDate, endDate string, employeeID uint) ([]posDto.PaymentHistoryItem, error) {
	// 1. ดึงประวัติจาก payment_repayments (การเคลียร์บิลเงินเชื่อ)
	repayments, err := s.paymentRepo.GetRepaymentHistory(search, startDate, endDate, employeeID)
	if err != nil {
		return nil, err
	}

	// 2. ดึงประวัติจาก payments (การชำระเงินสด / QR Code หน้าร้าน)
	payments, err := s.paymentRepo.GetDirectPaymentHistory(search, startDate, endDate, employeeID)
	if err != nil {
		return nil, err
	}

	var list []posDto.PaymentHistoryItem

	// Map Repayments
	for _, r := range repayments {
		paidTime := r.CreatedAt
		if r.PaidAt != nil {
			paidTime = *r.PaidAt
		}

		custName := ""
		if r.Order.Customer.ID != 0 && r.Order.Customer.CustomerName != "" {
			custName = r.Order.Customer.CustomerName
		} else if r.Order.CustomerNameTemp != nil {
			custName = *r.Order.CustomerNameTemp
		}

		recName := ""
		if r.RecordedBy.FirstName != "" || r.RecordedBy.LastName != "" {
			recName = strings.TrimSpace(r.RecordedBy.FirstName + " " + r.RecordedBy.LastName)
		} else {
			recName = r.RecordedBy.Username
		}

		var reqByName string
		if r.CancelRequestedBy != nil {
			if r.CancelRequestedBy.FirstName != "" || r.CancelRequestedBy.LastName != "" {
				reqByName = strings.TrimSpace(r.CancelRequestedBy.FirstName + " " + r.CancelRequestedBy.LastName)
			} else {
				reqByName = r.CancelRequestedBy.Username
			}
		}

		var cancelByName string
		if r.CancelledBy != nil {
			if r.CancelledBy.FirstName != "" || r.CancelledBy.LastName != "" {
				cancelByName = strings.TrimSpace(r.CancelledBy.FirstName + " " + r.CancelledBy.LastName)
			} else {
				cancelByName = r.CancelledBy.Username
			}
		}

		list = append(list, posDto.PaymentHistoryItem{
			ReceiptID:             r.ID,
			ReceiptNumber:         r.ReceiptNumber,
			PaidAt:                paidTime,
			CustomerName:          custName,
			PaymentMethod:         r.PaymentMethod.MethodName,
			OrderNumbers:          r.Order.OrderNumber,
			TotalReceived:         r.AmountPaid,
			Status:                r.Status,
			ReceivedByID:          r.RecordedByID,
			ReceivedByName:        recName,
			PaymentType:           "repayment",
			CancelReason:          r.CancelReason,
			CancelRequestedByID:   r.CancelRequestedByID,
			CancelRequestedByName: reqByName,
			CancelRequestedAt:     r.CancelRequestedAt,
			CancelledByID:         r.CancelledByID,
			CancelledByName:       cancelByName,
			CancelledAt:           r.CancelledAt,
			CancelRemark:          r.CancelRemark,
		})
	}

	// Map Direct Payments
	for _, p := range payments {
		paidTime := p.CreatedAt
		if p.PaidAt != nil {
			paidTime = *p.PaidAt
		}

		custName := ""
		if p.Order.Customer.ID != 0 && p.Order.Customer.CustomerName != "" {
			custName = p.Order.Customer.CustomerName
		} else if p.Order.CustomerNameTemp != nil {
			custName = *p.Order.CustomerNameTemp
		}

		recName := ""
		if p.ReceivedBy.FirstName != "" || p.ReceivedBy.LastName != "" {
			recName = strings.TrimSpace(p.ReceivedBy.FirstName + " " + p.ReceivedBy.LastName)
		} else {
			recName = p.ReceivedBy.Username
		}

		receiptNo := p.ReferenceNumber
		if receiptNo == "" {
			receiptNo = fmt.Sprintf("PAY-%s", p.Order.OrderNumber)
		}

		status := "completed"
		var cancelReason string
		var cancelRemark string
		var cancelReqByName string
		var cancelReqAt *time.Time
		var cancelReqByID *uint
		var cancelAt *time.Time

		if p.Order.Status == "cancelled" {
			status = "cancelled"
			if p.Order.CancelReason != nil {
				cancelReason = *p.Order.CancelReason
			}
			if p.Order.CancelRemark != nil {
				cancelRemark = *p.Order.CancelRemark
			}
			cancelReqAt = p.Order.CancelRequestedAt
			cancelReqByID = p.Order.CancelRequestedByID
			cancelAt = p.Order.CancelProcessedAt

			if p.Order.CancelRequestedBy != nil {
				if p.Order.CancelRequestedBy.FirstName != "" || p.Order.CancelRequestedBy.LastName != "" {
					cancelReqByName = strings.TrimSpace(p.Order.CancelRequestedBy.FirstName + " " + p.Order.CancelRequestedBy.LastName)
				} else {
					cancelReqByName = p.Order.CancelRequestedBy.Username
				}
			}
		}

		list = append(list, posDto.PaymentHistoryItem{
			ReceiptID:             p.ID,
			ReceiptNumber:         receiptNo,
			PaidAt:                paidTime,
			CustomerName:          custName,
			PaymentMethod:         p.PaymentMethod.MethodName,
			OrderNumbers:          p.Order.OrderNumber,
			TotalReceived:         p.Amount,
			Status:                status,
			ReceivedByID:          p.ReceivedByID,
			ReceivedByName:        recName,
			PaymentType:           "payment",
			CancelReason:          cancelReason,
			CancelRequestedByID:   cancelReqByID,
			CancelRequestedByName: cancelReqByName,
			CancelRequestedAt:     cancelReqAt,
			CancelledAt:           cancelAt,
			CancelRemark:          cancelRemark,
		})
	}

	// เรียงลำดับประวัติการชำระเงินตามเวลาล่าสุด (PaidAt Descending)
	sort.Slice(list, func(i, j int) bool {
		return list[i].PaidAt.After(list[j].PaidAt)
	})

	return list, nil
}

func (s *paymentService) GetPaymentHistoryByID(receiptID uint) (*posDto.PaymentHistoryItem, error) {
	r, err := s.paymentRepo.GetRepaymentByID(receiptID)
	if err == nil && r != nil && r.ID != 0 {
		paidTime := r.CreatedAt
		if r.PaidAt != nil {
			paidTime = *r.PaidAt
		}

		custName := ""
		if r.Order.Customer.ID != 0 && r.Order.Customer.CustomerName != "" {
			custName = r.Order.Customer.CustomerName
		} else if r.Order.CustomerNameTemp != nil {
			custName = *r.Order.CustomerNameTemp
		}

		recName := ""
		if r.RecordedBy.FirstName != "" || r.RecordedBy.LastName != "" {
			recName = strings.TrimSpace(r.RecordedBy.FirstName + " " + r.RecordedBy.LastName)
		} else {
			recName = r.RecordedBy.Username
		}

		var reqByName string
		if r.CancelRequestedBy != nil {
			if r.CancelRequestedBy.FirstName != "" || r.CancelRequestedBy.LastName != "" {
				reqByName = strings.TrimSpace(r.CancelRequestedBy.FirstName + " " + r.CancelRequestedBy.LastName)
			} else {
				reqByName = r.CancelRequestedBy.Username
			}
		}

		var cancelByName string
		if r.CancelledBy != nil {
			if r.CancelledBy.FirstName != "" || r.CancelledBy.LastName != "" {
				cancelByName = strings.TrimSpace(r.CancelledBy.FirstName + " " + r.CancelledBy.LastName)
			} else {
				cancelByName = r.CancelledBy.Username
			}
		}

		return &posDto.PaymentHistoryItem{
			ReceiptID:             r.ID,
			ReceiptNumber:         r.ReceiptNumber,
			PaidAt:                paidTime,
			CustomerName:          custName,
			PaymentMethod:         r.PaymentMethod.MethodName,
			OrderNumbers:          r.Order.OrderNumber,
			TotalReceived:         r.AmountPaid,
			Status:                r.Status,
			ReceivedByID:          r.RecordedByID,
			ReceivedByName:        recName,
			PaymentType:           "repayment",
			CancelReason:          r.CancelReason,
			CancelRequestedByID:   r.CancelRequestedByID,
			CancelRequestedByName: reqByName,
			CancelRequestedAt:     r.CancelRequestedAt,
			CancelledByID:         r.CancelledByID,
			CancelledByName:       cancelByName,
			CancelledAt:           r.CancelledAt,
			CancelRemark:          r.CancelRemark,
		}, nil
	}

	// ถ้าไม่พบใน PaymentRepayment ให้ค้นหาใน Payment (Direct Payment)
	p, err := s.paymentRepo.GetPaymentWithDetailsByID(receiptID)
	if err != nil {
		return nil, fmt.Errorf("ไม่พบข้อมูลการชำระเงินรหัส %d", receiptID)
	}

	paidTime := p.CreatedAt
	if p.PaidAt != nil {
		paidTime = *p.PaidAt
	}

	custName := ""
	if p.Order.Customer.ID != 0 && p.Order.Customer.CustomerName != "" {
		custName = p.Order.Customer.CustomerName
	} else if p.Order.CustomerNameTemp != nil {
		custName = *p.Order.CustomerNameTemp
	}

	recName := ""
	if p.ReceivedBy.FirstName != "" || p.ReceivedBy.LastName != "" {
		recName = strings.TrimSpace(p.ReceivedBy.FirstName + " " + p.ReceivedBy.LastName)
	} else {
		recName = p.ReceivedBy.Username
	}

	receiptNo := p.ReferenceNumber
	if receiptNo == "" {
		receiptNo = fmt.Sprintf("PAY-%s", p.Order.OrderNumber)
	}

	status := "completed"
	var cancelReason string
	var cancelRemark string
	var cancelReqByName string
	var cancelReqAt *time.Time
	var cancelReqByID *uint
	var cancelAt *time.Time

	if p.Order.Status == "cancelled" {
		status = "cancelled"
		if p.Order.CancelReason != nil {
			cancelReason = *p.Order.CancelReason
		}
		if p.Order.CancelRemark != nil {
			cancelRemark = *p.Order.CancelRemark
		}
		cancelReqAt = p.Order.CancelRequestedAt
		cancelReqByID = p.Order.CancelRequestedByID
		cancelAt = p.Order.CancelProcessedAt

		if p.Order.CancelRequestedBy != nil {
			if p.Order.CancelRequestedBy.FirstName != "" || p.Order.CancelRequestedBy.LastName != "" {
				cancelReqByName = strings.TrimSpace(p.Order.CancelRequestedBy.FirstName + " " + p.Order.CancelRequestedBy.LastName)
			} else {
				cancelReqByName = p.Order.CancelRequestedBy.Username
			}
		}
	}

	return &posDto.PaymentHistoryItem{
		ReceiptID:             p.ID,
		ReceiptNumber:         receiptNo,
		PaidAt:                paidTime,
		CustomerName:          custName,
		PaymentMethod:         p.PaymentMethod.MethodName,
		OrderNumbers:          p.Order.OrderNumber,
		TotalReceived:         p.Amount,
		Status:                status,
		ReceivedByID:          p.ReceivedByID,
		ReceivedByName:        recName,
		PaymentType:           "payment",
		CancelReason:          cancelReason,
		CancelRequestedByID:   cancelReqByID,
		CancelRequestedByName: cancelReqByName,
		CancelRequestedAt:     cancelReqAt,
		CancelledAt:           cancelAt,
		CancelRemark:          cancelRemark,
	}, nil
}

// -------------------------------------------------------------
// 5. ประวัติการยกเลิกการชำระเงิน (Cancelled Payments)
// -------------------------------------------------------------
func (s *paymentService) GetCancelledPaymentHistory(search, startDate, endDate string) ([]posDto.CancelledPaymentItem, error) {
	repayments, err := s.paymentRepo.GetCancelledRepaymentHistory(search, startDate, endDate)
	if err != nil {
		return nil, err
	}

	var list []posDto.CancelledPaymentItem
	for _, r := range repayments {
		paidTime := r.CreatedAt
		if r.PaidAt != nil {
			paidTime = *r.PaidAt
		}

		custName := ""
		if r.Order.Customer.ID != 0 && r.Order.Customer.CustomerName != "" {
			custName = r.Order.Customer.CustomerName
		} else if r.Order.CustomerNameTemp != nil {
			custName = *r.Order.CustomerNameTemp
		}

		cancelledByName := ""
		if r.CancelledBy != nil {
			if r.CancelledBy.FirstName != "" || r.CancelledBy.LastName != "" {
				cancelledByName = strings.TrimSpace(r.CancelledBy.FirstName + " " + r.CancelledBy.LastName)
			} else {
				cancelledByName = r.CancelledBy.Username
			}
		}

		list = append(list, posDto.CancelledPaymentItem{
			ReceiptID:       r.ID,
			ReceiptNumber:   r.ReceiptNumber,
			OriginalPaidAt:  paidTime,
			CustomerName:    custName,
			TotalAmount:     r.AmountPaid,
			CancelledAt:     r.CancelledAt,
			CancelledByName: cancelledByName,
			CancelReason:    r.CancelReason,
		})
	}
	return list, nil
}

// -------------------------------------------------------------
// 6. พนักงานส่งคำขอยกเลิกใบเสร็จ (Request Cancel Repayment)
// -------------------------------------------------------------
func (s *paymentService) RequestCancelPaymentReceipt(repaymentID uint, userID uint, reason string) error {
	repayment, err := s.paymentRepo.GetRepaymentByID(repaymentID)
	if err != nil {
		return fmt.Errorf("ไม่พบรายการชำระเงินนี้")
	}
	if repayment.Status == "cancelled" {
		return errors.New("รายการนี้ถูกยกเลิกไปแล้ว")
	}
	if repayment.Status == "pending_cancel" {
		return errors.New("รายการนี้ได้ส่งคำขอยกเลิกไปแล้ว อยู่ระหว่างรอเจ้าของร้านอนุมัติ")
	}
	if err := s.paymentRepo.RequestCancelRepayment(repaymentID, userID, reason); err != nil {
		return err
	}

	// แจ้งเตือนส่งถึง Owner/Manager ทันทีเมื่อพนักงานยื่นคำขอยกเลิกการชำระเงิน
	if s.notification != nil {
		title := "มีคำขอยกเลิกการรับชำระเงิน"
		receiptNo := repayment.ReceiptNumber
		if receiptNo == "" {
			receiptNo = fmt.Sprintf("#%d", repayment.ID)
		}
		msg := fmt.Sprintf("คำขอยกเลิกใบเสร็จรับเงินเลขที่ %s (เหตุผล: %s)", receiptNo, reason)
		link := "/owner/transactions/payment-cancellation-history"
		if err := s.notification.NotifyOwners("warning", title, msg, link, nil); err != nil {
			fmt.Printf("[Notification] failed to notify owners (repayment %d): %v\n", repaymentID, err)
		}
	}

	return nil
}

// -------------------------------------------------------------
// 7. พนักงานดึงคำขอยกเลิกใบเสร็จกลับ (Revert Cancel Request)
// -------------------------------------------------------------
func (s *paymentService) RevertCancelPaymentReceiptRequest(repaymentID uint, userID uint, isOwnerOrAdmin bool) error {
	repayment, err := s.paymentRepo.GetRepaymentByID(repaymentID)
	if err != nil {
		return fmt.Errorf("ไม่พบรายการชำระเงินนี้")
	}
	if repayment.Status != "pending_cancel" {
		return errors.New("รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติการยกเลิก")
	}
	if !isOwnerOrAdmin {
		if repayment.CancelRequestedByID != nil && *repayment.CancelRequestedByID != userID && repayment.RecordedByID != userID {
			return errors.New("คุณไม่มีสิทธิ์ดึงคำขอยกเลิกของพนักงานท่านอื่นกลับ")
		}
	}
	return s.paymentRepo.RevertCancelRepayment(repaymentID)
}

// -------------------------------------------------------------
// 8. เจ้าของร้านอนุมัติการยกเลิกใบเสร็จ (Approve Cancel / คืนยอดหนี้)
// -------------------------------------------------------------
func (s *paymentService) ApproveCancelPaymentReceipt(repaymentID uint, ownerID uint, remark string) error {
	tx := s.paymentRepo.BeginTransaction()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	repayment, err := s.paymentRepo.GetRepaymentByID(repaymentID)
	if err != nil {
		tx.Rollback()
		return fmt.Errorf("ไม่พบรายการชำระเงินนี้")
	}

	if repayment.Status == "cancelled" {
		tx.Rollback()
		return errors.New("รายการนี้ถูกยกเลิกไปแล้ว")
	}

	targetUserID := repayment.CancelRequestedByID

	now := time.Now()
	repayment.Status = "cancelled"
	repayment.CancelledByID = &ownerID
	repayment.CancelledAt = &now
	if remark != "" {
		repayment.CancelRemark = remark
	}

	if err := s.paymentRepo.UpdateRepaymentWithTx(tx, repayment); err != nil {
		tx.Rollback()
		return err
	}

	order, err := s.paymentRepo.GetOrderById(repayment.OrderID)
	if err != nil {
		tx.Rollback()
		return err
	}

	// หักลบยอดที่เคยตัดออก เพื่อดึงยอดกลับมาเป็นยอดหนี้
	order.PaidAmount -= repayment.AmountPaid
	if order.PaidAmount < 0 {
		order.PaidAmount = 0
	}
	order.BalanceDue = order.TotalAmount - order.PaidAmount

	if order.PaidAmount == 0 {
		order.PaymentStatus = "unpaid"
	} else {
		order.PaymentStatus = "partial"
	}

	if err := s.paymentRepo.UpdateOrderWithTx(tx, order); err != nil {
		tx.Rollback()
		return err
	}

	// เพิ่มยอดหนี้สะสมของลูกค้ากลับเข้ามา
	if order.CustomerID != nil {
		var cust entity.Customer
		if err := tx.First(&cust, *order.CustomerID).Error; err == nil {
			cust.CurrentDebtAmount += repayment.AmountPaid
			if err := tx.Save(&cust).Error; err != nil {
				tx.Rollback()
				return err
			}
		}
	}

	if err := tx.Commit().Error; err != nil {
		return err
	}

	// แจ้งเตือนส่งกลับไปยัง Staff ผู้ส่งคำขอ เมื่อ Owner กดอนุมัติ
	if s.notification != nil && targetUserID != nil && *targetUserID != 0 && *targetUserID != ownerID {
		title := "อนุมัติคำขอยกเลิกการรับชำระเงินแล้ว"
		receiptNo := repayment.ReceiptNumber
		if receiptNo == "" {
			receiptNo = fmt.Sprintf("#%d", repayment.ID)
		}
		msg := fmt.Sprintf("คำขอยกเลิกใบเสร็จรับเงินเลขที่ %s ได้รับการอนุมัติแล้ว", receiptNo)
		if remark != "" {
			msg = fmt.Sprintf("คำขอยกเลิกใบเสร็จรับเงินเลขที่ %s ได้รับการอนุมัติแล้ว (หมายเหตุ: %s)", receiptNo, remark)
		}
		link := "/employee/transactions/payment-cancellation-history"
		if err := s.notification.NotifyUser(*targetUserID, "success", title, msg, link, nil); err != nil {
			fmt.Printf("[Notification] failed to notify user %d (repayment %d): %v\n", *targetUserID, repaymentID, err)
		}
	}

	return nil
}

// -------------------------------------------------------------
// 9. เจ้าของร้านปฏิเสธคำขอยกเลิกใบเสร็จ (Reject Cancel)
// -------------------------------------------------------------
func (s *paymentService) RejectCancelPaymentReceipt(repaymentID uint, remark string) error {
	repayment, err := s.paymentRepo.GetRepaymentByID(repaymentID)
	if err != nil {
		return fmt.Errorf("ไม่พบรายการชำระเงินนี้")
	}
	if repayment.Status != "pending_cancel" {
		return errors.New("รายการนี้ไม่ได้อยู่ในสถานะรออนุมัติการยกเลิก")
	}

	targetUserID := repayment.CancelRequestedByID

	if err := s.paymentRepo.RejectCancelRepayment(repaymentID, remark); err != nil {
		return err
	}

	// แจ้งเตือนส่งกลับไปยัง Staff ผู้ส่งคำขอ เมื่อ Owner กดปฏิเสธ
	if s.notification != nil && targetUserID != nil && *targetUserID != 0 {
		title := "ปฏิเสธคำขอยกเลิกการรับชำระเงิน"
		receiptNo := repayment.ReceiptNumber
		if receiptNo == "" {
			receiptNo = fmt.Sprintf("#%d", repayment.ID)
		}
		msg := fmt.Sprintf("คำขอยกเลิกใบเสร็จรับเงินเลขที่ %s ถูกปฏิเสธ", receiptNo)
		if remark != "" {
			msg = fmt.Sprintf("คำขอยกเลิกใบเสร็จรับเงินเลขที่ %s ถูกปฏิเสธ (หมายเหตุ: %s)", receiptNo, remark)
		}
		link := "/employee/transactions/payment-cancellation-history"
		if err := s.notification.NotifyUser(*targetUserID, "error", title, msg, link, nil); err != nil {
			fmt.Printf("[Notification] failed to notify user %d (repayment %d): %v\n", *targetUserID, repaymentID, err)
		}
	}

	return nil
}

// -------------------------------------------------------------
// 10. ยกเลิกการรับเงิน (รองรับเรียกแบบเดิม)
// -------------------------------------------------------------
func (s *paymentService) CancelPaymentReceipt(repaymentID uint, req posDto.CancelPaymentReceiptRequest) error {
	return s.ApproveCancelPaymentReceipt(repaymentID, req.CancelledByID, req.Reason)
}
