package pos

import (
	"encoding/base64"
	"fmt"
	"time"

	"backend/internal/app/entity"

	"github.com/skip2/go-qrcode"
	"gorm.io/gorm"
)

type PaymentRepository interface {
	GetOrderById(orderID uint) (*entity.SaleOrder, error)
	GetPaymentByOrderId(orderID uint) (*entity.Payment, error)
	GetPaymentByID(paymentID uint) (*entity.Payment, error)
	GetPaymentWithDetailsByID(paymentID uint) (*entity.Payment, error)
	CreatePayment(payment *entity.Payment) error
	CreatePaymentWithTx(tx *gorm.DB, payment *entity.Payment) error 
	UpdatePayment(payment *entity.Payment) error
	UpdatePaymentWithTx(tx *gorm.DB, payment *entity.Payment) error
	UpdateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error
	GeneratePromptPayQR(promptPayNo string, amount float64) (string, error)
	BeginTransaction() *gorm.DB
	GetStoreConfig() (*entity.StoreConfig, error)

	GetUnpaidOrdersByCustomerID(customerID uint) ([]entity.SaleOrder, error)
	GetUnpaidOrderByOrderNumber(orderNumber string) (*entity.SaleOrder, error)
    CreateRepaymentWithTx(tx *gorm.DB, repayment *entity.PaymentRepayment) error
    GetRepaymentByID(repaymentID uint) (*entity.PaymentRepayment, error)
    UpdateRepaymentWithTx(tx *gorm.DB, repayment *entity.PaymentRepayment) error
    GetRepaymentHistory(search, startDate, endDate string, employeeID uint) ([]entity.PaymentRepayment, error)
    GetDirectPaymentHistory(search, startDate, endDate string, employeeID uint) ([]entity.Payment, error)
    GetCancelledRepaymentHistory(search, startDate, endDate string) ([]entity.PaymentRepayment, error)
    RequestCancelRepayment(repaymentID uint, userID uint, reason string) error
    RevertCancelRepayment(repaymentID uint) error
    RejectCancelRepayment(repaymentID uint, remark string) error
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

func (r *paymentRepository) GetPaymentWithDetailsByID(paymentID uint) (*entity.Payment, error) {
	var payment entity.Payment
	err := r.db.Preload("Order").Preload("Order.Customer").Preload("PaymentMethod").Preload("ReceivedBy").First(&payment, paymentID).Error
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

func (r *paymentRepository) GetStoreConfig() (*entity.StoreConfig, error) {
	var config entity.StoreConfig
	if err := r.db.First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *paymentRepository) GetUnpaidOrdersByCustomerID(customerID uint) ([]entity.SaleOrder, error) {
    var orders []entity.SaleOrder
    err := r.db.Preload("Customer").
        Preload("Customer.CustomerType"). 
        Where("customer_id = ? AND payment_status IN ('unpaid', 'partial') AND status NOT IN ('cancelled', 'pending_cancel')", customerID).
        Order("created_at asc").
        Find(&orders).Error
    return orders, err
}

func (r *paymentRepository) GetUnpaidOrderByOrderNumber(orderNumber string) (*entity.SaleOrder, error) {
    var order entity.SaleOrder
    err := r.db.Preload("Customer").
        Preload("Customer.CustomerType").
        Where("order_number = ? AND payment_status IN ('unpaid', 'partial') AND status NOT IN ('cancelled', 'pending_cancel')", orderNumber).
        First(&order).Error
    if err != nil {
        return nil, err
    }
    return &order, nil
}

func (r *paymentRepository) CreateRepaymentWithTx(tx *gorm.DB, repayment *entity.PaymentRepayment) error {
    return tx.Create(repayment).Error
}

func (r *paymentRepository) GetRepaymentByID(repaymentID uint) (*entity.PaymentRepayment, error) {
    var repayment entity.PaymentRepayment
    err := r.db.Preload("Order").
        Preload("Order.Customer").
        Preload("PaymentMethod").
        Preload("RecordedBy").
        Preload("CancelRequestedBy").
        Preload("CancelledBy").
        First(&repayment, repaymentID).Error
    return &repayment, err
}

func (r *paymentRepository) UpdateRepaymentWithTx(tx *gorm.DB, repayment *entity.PaymentRepayment) error {
    return tx.Save(repayment).Error
}

func (r *paymentRepository) GetRepaymentHistory(search, startDate, endDate string, employeeID uint) ([]entity.PaymentRepayment, error) {
    var repayments []entity.PaymentRepayment
    query := r.db.Preload("Order").
        Preload("Order.Customer").
        Preload("PaymentMethod").
        Preload("RecordedBy").
        Preload("CancelRequestedBy").
        Where("payment_repayments.status IN (?)", []string{"completed", "pending_cancel"})

    if employeeID > 0 {
        query = query.Where("payment_repayments.recorded_by_id = ?", employeeID)
    }

    if search != "" {
        likeSearch := "%" + search + "%"
        query = query.Joins("LEFT JOIN sale_orders ON sale_orders.id = payment_repayments.order_id").
            Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("payment_repayments.receipt_number LIKE ? OR sale_orders.order_number LIKE ? OR customers.customer_name LIKE ? OR sale_orders.customer_name_temp LIKE ?", likeSearch, likeSearch, likeSearch, likeSearch)
    }

    if startDate != "" && endDate != "" {
        query = query.Where("payment_repayments.created_at BETWEEN ? AND ?", startDate+" 00:00:00", endDate+" 23:59:59")
    } else if startDate != "" {
        query = query.Where("payment_repayments.created_at >= ?", startDate+" 00:00:00")
    } else if endDate != "" {
        query = query.Where("payment_repayments.created_at <= ?", endDate+" 23:59:59")
    }
    err := query.Order("payment_repayments.created_at desc").Find(&repayments).Error
    return repayments, err
}

func (r *paymentRepository) GetDirectPaymentHistory(search, startDate, endDate string, employeeID uint) ([]entity.Payment, error) {
    var payments []entity.Payment
    query := r.db.Preload("Order").
        Preload("Order.Customer").
        Preload("PaymentMethod").
        Preload("ReceivedBy").
        Joins("JOIN sale_orders ON sale_orders.id = payments.order_id").
        Where("payments.paid_at IS NOT NULL AND sale_orders.status != ?", "cancelled")

    if employeeID > 0 {
        query = query.Where("payments.received_by_id = ?", employeeID)
    }

    if search != "" {
        likeSearch := "%" + search + "%"
        query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("payments.reference_number LIKE ? OR sale_orders.order_number LIKE ? OR customers.customer_name LIKE ? OR sale_orders.customer_name_temp LIKE ?", likeSearch, likeSearch, likeSearch, likeSearch)
    }

    if startDate != "" && endDate != "" {
        query = query.Where("payments.paid_at BETWEEN ? AND ? OR (payments.paid_at IS NULL AND payments.created_at BETWEEN ? AND ?)", startDate+" 00:00:00", endDate+" 23:59:59", startDate+" 00:00:00", endDate+" 23:59:59")
    } else if startDate != "" {
        query = query.Where("payments.paid_at >= ? OR (payments.paid_at IS NULL AND payments.created_at >= ?)", startDate+" 00:00:00", startDate+" 00:00:00")
    } else if endDate != "" {
        query = query.Where("payments.paid_at <= ? OR (payments.paid_at IS NULL AND payments.created_at <= ?)", endDate+" 23:59:59", endDate+" 23:59:59")
    }

    err := query.Order("payments.paid_at desc, payments.created_at desc").Find(&payments).Error
    return payments, err
}

func (r *paymentRepository) GetCancelledRepaymentHistory(search, startDate, endDate string) ([]entity.PaymentRepayment, error) {
    var repayments []entity.PaymentRepayment
    query := r.db.Preload("Order").
        Preload("Order.Customer").
        Preload("PaymentMethod").
        Preload("RecordedBy").
        Preload("CancelRequestedBy").
        Preload("CancelledBy").
        Where("payment_repayments.status = ?", "cancelled")

    if search != "" {
        likeSearch := "%" + search + "%"
        query = query.Joins("LEFT JOIN sale_orders ON sale_orders.id = payment_repayments.order_id").
            Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("payment_repayments.receipt_number LIKE ? OR sale_orders.order_number LIKE ? OR customers.customer_name LIKE ? OR sale_orders.customer_name_temp LIKE ?", likeSearch, likeSearch, likeSearch, likeSearch)
    }

    if startDate != "" && endDate != "" {
        query = query.Where("payment_repayments.cancelled_at BETWEEN ? AND ?", startDate+" 00:00:00", endDate+" 23:59:59")
    } else if startDate != "" {
        query = query.Where("payment_repayments.cancelled_at >= ?", startDate+" 00:00:00")
    } else if endDate != "" {
        query = query.Where("payment_repayments.cancelled_at <= ?", endDate+" 23:59:59")
    }
    err := query.Order("payment_repayments.cancelled_at desc").Find(&repayments).Error
    return repayments, err
}

// พนักงานส่งคำขอยกเลิกใบเสร็จ (Repayment)
func (r *paymentRepository) RequestCancelRepayment(repaymentID uint, userID uint, reason string) error {
    now := time.Now()
    return r.db.Model(&entity.PaymentRepayment{}).
        Where("id = ?", repaymentID).
        Updates(map[string]interface{}{
            "status":                 "pending_cancel",
            "cancel_reason":          reason,
            "cancel_requested_at":    now,
            "cancel_requested_by_id": userID,
        }).Error
}

// พนักงานดึงคำขอยกเลิกกลับ (เมื่อยังอยู่ในสถานะ pending_cancel)
func (r *paymentRepository) RevertCancelRepayment(repaymentID uint) error {
    return r.db.Model(&entity.PaymentRepayment{}).
        Where("id = ? AND status = ?", repaymentID, "pending_cancel").
        Updates(map[string]interface{}{
            "status":                 "completed",
            "cancel_reason":          "",
            "cancel_requested_at":    nil,
            "cancel_requested_by_id": nil,
        }).Error
}

// เจ้าของร้านปฏิเสธคำขอยกเลิก (เปลี่ยนสถานะกลับเป็น completed)
func (r *paymentRepository) RejectCancelRepayment(repaymentID uint, remark string) error {
    return r.db.Model(&entity.PaymentRepayment{}).
        Where("id = ?", repaymentID).
        Updates(map[string]interface{}{
            "status":        "completed",
            "cancel_remark": remark,
        }).Error
}