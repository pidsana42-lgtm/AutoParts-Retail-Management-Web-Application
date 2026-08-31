package pos

import (
	"context"
	"backend/internal/app/dto/pos"
	"backend/internal/app/entity"

	"backend/internal/app/enum"
	"gorm.io/gorm"
	"strconv"
	"time"
	"strings"
)

type SalesHistoryRepository interface {
	GetSalesHistory(req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
	GetSaleHistoryByID(identifier string) (*entity.SaleOrder, error)
	RequestCancelOrder(orderID uint, userID uint, reason string) error
	ApproveCancelOrder(order *entity.SaleOrder, remark string) error
	RejectCancelOrder(orderID uint, remark string) error
	RevertCancelOrder(orderID uint, note string) error
	GetCancellationRequests(req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
	GetMyCancellationRequests(userID uint, req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
	GetEmployees() ([]entity.User, error)
	GetUserByID(userID uint) (*entity.User, error)
	GetCompanySetting(ctx context.Context) (*entity.CompanySetting, error)
}

type salesHistoryRepository struct {
	db *gorm.DB
}

func NewSalesHistoryRepository(db *gorm.DB) SalesHistoryRepository {
	return &salesHistoryRepository{db: db}
}

func (r *salesHistoryRepository) GetSalesHistory(req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
    var orders []entity.SaleOrder
    var totalRows int64

    query := r.db.Model(&entity.SaleOrder{}).
        Preload("Customer").
        Preload("Customer.CustomerType").
        Preload("PaymentMethod").
        Preload("Payments.PaymentMethod").
        Preload("CreatedBy").
        Preload("CancelRequestedBy")

    // 1. ค้นหาบาร์โค้ด / เลข Order / ชื่อลูกค้า
    if req.Search != "" {
        query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("sale_orders.order_number LIKE ? OR sale_orders.customer_name_temp LIKE ? OR customers.customer_name LIKE ?",
                "%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
    }

    // 2. กรองตามวันที่ (รองรับทั้งใส่วันเดียว หรือใส่ครบช่วง)
    if req.StartDate != "" && req.EndDate != "" {
        // ตัด T23:59:59 ฝั่ง Frontend ออกถ้ามี ป้องกัน String ต่อซ้ำ
        startDate := strings.Split(req.StartDate, "T")[0]
        endDate := strings.Split(req.EndDate, "T")[0]
        query = query.Where("sale_orders.created_at BETWEEN ? AND ?", startDate+" 00:00:00", endDate+" 23:59:59")
    } else if req.StartDate != "" {
        startDate := strings.Split(req.StartDate, "T")[0]
        query = query.Where("sale_orders.created_at >= ?", startDate+" 00:00:00")
    } else if req.EndDate != "" {
        endDate := strings.Split(req.EndDate, "T")[0]
        query = query.Where("sale_orders.created_at <= ?", endDate+" 23:59:59")
    }

    // 3. กรองประเภทลูกค้า (Customer Type)
    // รองรับทั้ง CustomerTypeID (int) หรือ CustomerType Code (string)
    if req.CustomerType != "" || req.CustomerTypeID != 0 {
        if req.CustomerType == "GENERAL" {
            // ลูกค้าขาจร: ไม่มี customer_id หรือผูกกับ type_id = 1
            query = query.Where("sale_orders.customer_id IS NULL OR sale_orders.customer_id IN (SELECT id FROM customers WHERE customer_type_id = 1)")
        } else {
            query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
                Joins("LEFT JOIN customer_types ON customer_types.id = customers.customer_type_id")

            if req.CustomerType != "" {
                query = query.Where("customer_types.type_name = ?", req.CustomerType)
            } else {
                query = query.Where("customers.customer_type_id = ?", req.CustomerTypeID)
            }
        }
    }

    // 4. กรองวิธีการชำระเงิน (Payment Method)
    // รองรับทั้ง PaymentMethodID (int) หรือ PaymentMethod Code (string: "CASH", "TRANSFER")
    if req.PaymentMethod != "" || req.PaymentMethodID != 0 {
        query = query.Joins("LEFT JOIN payment_methods ON payment_methods.id = sale_orders.payment_method_id").
            Joins("LEFT JOIN payments ON payments.order_id = sale_orders.id").
            Joins("LEFT JOIN payment_methods pm2 ON pm2.id = payments.payment_method_id")

        if req.PaymentMethod != "" {
            var targetID int
            var keyword string

            switch req.PaymentMethod {
            case "CASH":
                targetID = 1
                keyword = "เงินสด"
            case "QR", "TRANSFER", "PaymentMethodQR":
                targetID = 2
                keyword = "เงินโอน"
            case "CREDIT", "PaymentMethodCredit":
                targetID = 3
                keyword = "เงินเชื่อ"
            default:
                keyword = req.PaymentMethod
            }

            if targetID > 0 {
                // กรองด้วย ID ตรงๆ ชัวร์และเร็วกว่า
                query = query.Where("sale_orders.payment_method_id = ? OR payments.payment_method_id = ?", targetID, targetID)
            } else {
                // เผื่อกรณี ค้นหาด้วย keyword
                query = query.Where("payment_methods.method_name LIKE ? OR pm2.method_name LIKE ?", "%"+keyword+"%", "%"+keyword+"%")
            }
        } else {
            query = query.Where("sale_orders.payment_method_id = ? OR payments.payment_method_id = ?", req.PaymentMethodID, req.PaymentMethodID)
        }
        query = query.Group("sale_orders.id")
    }

    // 4.5 กรองตามพนักงานผู้บันทึกรายการ (EmployeeID)
    if req.EmployeeID != 0 {
        query = query.Where("sale_orders.created_by_id = ?", req.EmployeeID)
    }

    // 4.6 กรองตามสถานะคำสั่งซื้อ (Status)
    if req.Status != "" {
        cleanStatus := strings.ToLower(strings.TrimSpace(req.Status))
        query = query.Where("sale_orders.status = ?", cleanStatus)
    }

    // นับจำนวนรายการทั้งหมดก่อนทำ Pagination
    if err := query.Count(&totalRows).Error; err != nil {
        return nil, 0, err
    }

    // Pagination
    if req.Limit > 0 {
        page := req.Page
        if page <= 0 {
            page = 1
        }
        offset := (page - 1) * req.Limit
        query = query.Limit(req.Limit).Offset(offset)
    }

    query = query.Order("sale_orders.created_at DESC")

    if err := query.Find(&orders).Error; err != nil {
        return nil, 0, err
    }

    return orders, totalRows, nil
}

func (r *salesHistoryRepository) GetSaleHistoryByID(identifier string) (*entity.SaleOrder, error) {
	var order entity.SaleOrder

	// เช็คว่าถ้าสามารถแปลงเป็น uint ได้ แสดงว่าเป็น ID แต่ถ้าแปลงไม่ได้ แสดงว่าเป็น Order Number
	query := r.db.Model(&entity.SaleOrder{}).
		Preload("Customer").
		Preload("PaymentMethod").
		Preload("Customer.CustomerType").
		Preload("Payments").
		Preload("Payments.PaymentMethod").
		Preload("Payments.ReceivedBy").
		Preload("Items").
		Preload("Items.Product").
		Preload("Items.Product.Grade").
		Preload("Items.Product.Models").
		Preload("Items.Product.Models.Brand").
		Preload("CreatedBy").
		Preload("CancelRequestedBy")

	id, err := strconv.ParseUint(identifier, 10, 64)
	if err == nil && id > 0 {
		// ค้นหาด้วย Primary Key ID
		err = query.Where("id = ?", id).First(&order).Error
	} else {
		// ค้นหาด้วย Order Number
		err = query.Where("order_number = ?", identifier).First(&order).Error
	}

	if err != nil {
		return nil, err
	}

	return &order, nil
}

// พนักงานส่งคำขอยกเลิก
func (r *salesHistoryRepository) RequestCancelOrder(orderID uint, userID uint, reason string) error {
    now := time.Now()
    return r.db.Model(&entity.SaleOrder{}).
        Where("id = ?", orderID).
        Updates(map[string]interface{}{
            "status":                 enum.OrderPendingCancel,
            "cancel_reason":          reason,
            "cancel_requested_at":    now,
            "cancel_requested_by_id": userID,
            "cancel_remark":          nil,
            "cancel_processed_at":    nil,
        }).Error
}

// เจ้าของร้านอนุมัติการยกเลิก (เปลี่ยนสถานะ + Restock คืนสต็อก)
func (r *salesHistoryRepository) ApproveCancelOrder(order *entity.SaleOrder, remark string) error {
	now := time.Now()
	return r.db.Transaction(func(tx *gorm.DB) error {
		updates := map[string]interface{}{
			"status":              enum.OrderCancelled,
			"cancel_processed_at": now,
		}
		if remark != "" {
			updates["cancel_remark"] = remark
		}
		if order.CancelRequestedByID != nil {
			updates["cancel_requested_by_id"] = order.CancelRequestedByID
		}
		if order.CancelReason != nil {
			updates["cancel_reason"] = order.CancelReason
		}
		if order.CancelRequestedAt != nil {
			updates["cancel_requested_at"] = order.CancelRequestedAt
		}

		if err := tx.Model(&entity.SaleOrder{}).Where("id = ?", order.ID).Updates(updates).Error; err != nil {
			return err
		}

		// คืนยอดหนี้สะสมลูกค้า (ถ้า Order นั้นเคยชำระด้วยเงินเชื่อ)
		if order.PaymentMethod != nil && order.PaymentMethod.IsCredit && order.CustomerID != nil {
			if err := tx.Model(&entity.Customer{}).
				Where("id = ?", *order.CustomerID).
				UpdateColumn("current_debt_amount", gorm.Expr("current_debt_amount - ?", order.TotalAmount)).Error; err != nil {
				return err
			}
		}

		// คืนสต็อกสินค้า (Restock)
		for _, item := range order.Items {
			if err := tx.Model(&entity.Product{}).
				Where("id = ?", item.ProductID).
				UpdateColumn("quantity", gorm.Expr("quantity + ?", item.Qty)).Error; err != nil {
				return err
			}
		}

		return nil
	})
}

// เจ้าของร้านปฏิเสธการยกเลิก (เปลี่ยนกลับเป็น Completed)
func (r *salesHistoryRepository) RejectCancelOrder(orderID uint, remark string) error {
	now := time.Now()
	updates := map[string]interface{}{
		"status":              enum.OrderCompleted,
		"cancel_processed_at": now,
	}
	if remark != "" {
		updates["cancel_remark"] = remark
	}

	return r.db.Model(&entity.SaleOrder{}).Where("id = ?", orderID).Updates(updates).Error
}

func (r *salesHistoryRepository) GetCancellationRequests(req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
    var orders []entity.SaleOrder
    var totalRows int64

    query := r.db.Model(&entity.SaleOrder{}).
        Preload("Customer").
        Preload("Customer.CustomerType").
        Preload("PaymentMethod").
        Preload("Payments.PaymentMethod").
        Preload("Payments.ReceivedBy").
        Preload("CreatedBy").
        Preload("CancelRequestedBy").
        Where("cancel_requested_at IS NOT NULL OR status = ?", enum.OrderCancelled) // เฉพาะรายการที่มีการขอยกเลิกหรือถูกยกเลิกแล้ว

    // 1. ค้นหาบาร์โค้ด / เลข Order / ชื่อลูกค้า
    if req.Search != "" {
        query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("(sale_orders.order_number LIKE ? OR sale_orders.customer_name_temp LIKE ? OR customers.customer_name LIKE ?)",
                "%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
    }

    // 2. กรองช่วงวันที่ขอยกเลิก
    if req.StartDate != "" && req.EndDate != "" {
        startDate := strings.Split(req.StartDate, "T")[0]
        endDate := strings.Split(req.EndDate, "T")[0]
        query = query.Where("sale_orders.cancel_requested_at BETWEEN ? AND ?", startDate+" 00:00:00", endDate+" 23:59:59")
    }

    // 3. กรองประเภทลูกค้า (Customer Type)
    if req.CustomerType != "" {
        if req.CustomerType == "GENERAL" {
            query = query.Where("(sale_orders.customer_id IS NULL OR sale_orders.customer_id IN (SELECT id FROM customers WHERE customer_type_id = 1))")
        } else {
            query = query.Where("sale_orders.customer_id IN (SELECT id FROM customers WHERE customer_type_id IN (SELECT id FROM customer_types WHERE type_name = ?))", req.CustomerType)
        }
    }

    // 4. กรองตามสถานะคำขอยกเลิก (Status)
    if req.Status != "" {
        cleanStatus := strings.ToUpper(strings.TrimSpace(req.Status))
        if cleanStatus == "REJECTED" || cleanStatus == "ไม่อนุมัติ" {
            query = query.Where("sale_orders.status = ? AND (sale_orders.cancel_processed_at IS NOT NULL OR sale_orders.cancel_remark IS NOT NULL)", enum.OrderCompleted)
        } else if cleanStatus == "CANCELLED" || cleanStatus == "อนุมัติแล้ว" {
            query = query.Where("sale_orders.status = ?", enum.OrderCancelled)
        } else if cleanStatus == "PENDING_CANCEL" || cleanStatus == "รอดำเนินการ" {
            query = query.Where("sale_orders.status = ?", enum.OrderPendingCancel)
        } else {
            query = query.Where("sale_orders.status = ?", strings.ToLower(req.Status))
        }
    }

    // 4.5 กรองตามพนักงานที่ส่งคำขอยกเลิก (EmployeeID)
    if req.EmployeeID != 0 {
        query = query.Where("sale_orders.cancel_requested_by_id = ?", req.EmployeeID)
    }

    // นับจำนวนรายการทั้งหมด
    if err := query.Count(&totalRows).Error; err != nil {
        return nil, 0, err
    }

    // 5. ทำ Limit / Offset Pagination
    if req.Limit > 0 {
        page := req.Page
        if page <= 0 { page = 1 }
        offset := (page - 1) * req.Limit
        query = query.Limit(req.Limit).Offset(offset)
    }

    query = query.Order("cancel_requested_at DESC")

    if err := query.Find(&orders).Error; err != nil {
        return nil, 0, err
    }

    return orders, totalRows, nil
}

func (r *salesHistoryRepository) GetMyCancellationRequests(userID uint, req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
    var orders []entity.SaleOrder
    var totalRows int64

    query := r.db.Model(&entity.SaleOrder{}).
        Preload("Customer").
        Preload("Customer.CustomerType").
        Preload("PaymentMethod").
        Preload("Payments.PaymentMethod").
        Preload("Payments.ReceivedBy").
        Preload("CreatedBy").
        Preload("CancelRequestedBy").
        Where("(cancel_requested_at IS NOT NULL OR status = ?) AND cancel_requested_by_id = ?", enum.OrderCancelled, userID)

    // 1. ค้นหาบาร์โค้ด / เลข Order / ชื่อลูกค้า
    if req.Search != "" {
        query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("(sale_orders.order_number LIKE ? OR sale_orders.customer_name_temp LIKE ? OR customers.customer_name LIKE ?)",
                "%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
    }

    // 2. กรองช่วงวันที่ขอยกเลิก
    if req.StartDate != "" && req.EndDate != "" {
        startDate := strings.Split(req.StartDate, "T")[0]
        endDate := strings.Split(req.EndDate, "T")[0]
        query = query.Where("sale_orders.cancel_requested_at BETWEEN ? AND ?", startDate+" 00:00:00", endDate+" 23:59:59")
    }

    // 3. กรองประเภทลูกค้า (Customer Type)
    if req.CustomerType != "" {
        if req.CustomerType == "GENERAL" {
            query = query.Where("(sale_orders.customer_id IS NULL OR sale_orders.customer_id IN (SELECT id FROM customers WHERE customer_type_id = 1))")
        } else {
            query = query.Where("sale_orders.customer_id IN (SELECT id FROM customers WHERE customer_type_id IN (SELECT id FROM customer_types WHERE type_name = ?))", req.CustomerType)
        }
    }

    // 4. กรองตามสถานะคำขอยกเลิก (Status)
    if req.Status != "" {
        cleanStatus := strings.ToUpper(strings.TrimSpace(req.Status))
        if cleanStatus == "REJECTED" || cleanStatus == "ไม่อนุมัติ" {
            query = query.Where("sale_orders.status = ? AND (sale_orders.cancel_processed_at IS NOT NULL OR sale_orders.cancel_remark IS NOT NULL)", enum.OrderCompleted)
        } else if cleanStatus == "CANCELLED" || cleanStatus == "อนุมัติแล้ว" {
            query = query.Where("sale_orders.status = ?", enum.OrderCancelled)
        } else if cleanStatus == "PENDING_CANCEL" || cleanStatus == "รอดำเนินการ" {
            query = query.Where("sale_orders.status = ?", enum.OrderPendingCancel)
        } else {
            query = query.Where("sale_orders.status = ?", strings.ToLower(req.Status))
        }
    }

    // นับจำนวนรายการทั้งหมด
    if err := query.Count(&totalRows).Error; err != nil {
        return nil, 0, err
    }

    // 5. ทำ Limit / Offset Pagination
    if req.Limit > 0 {
        page := req.Page
        if page <= 0 { page = 1 }
        offset := (page - 1) * req.Limit
        query = query.Limit(req.Limit).Offset(offset)
    }

    query = query.Order("cancel_requested_at DESC")

    if err := query.Find(&orders).Error; err != nil {
        return nil, 0, err
    }

    return orders, totalRows, nil
}

func (r *salesHistoryRepository) RevertCancelOrder(orderID uint, note string) error {
	updates := map[string]interface{}{
		"status":                 enum.OrderCompleted, // เปลี่ยนกลับเป็น Completed
		"cancel_reason":          nil,                 // ล้างเหตุผลการยกเลิก
		"cancel_requested_at":    nil,                 // ล้างวันที่ขอยกเลิก
		"cancel_requested_by_id": nil,                 // ล้างผู้ขอยกเลิก
	}
	if note != "" {
		updates["note"] = note
	}
	return r.db.Model(&entity.SaleOrder{}).
		Where("id = ?", orderID).
		Updates(updates).Error
}

func (r *salesHistoryRepository) GetEmployees() ([]entity.User, error) {
	var users []entity.User
	err := r.db.Joins("JOIN roles ON roles.id = users.role_id").
		Where("roles.role_name IN ?", []string{"Employee", "Owner", "Admin"}).
		Find(&users).Error
	return users, err
}

func (r *salesHistoryRepository) GetUserByID(userID uint) (*entity.User, error) {
	var user entity.User
	err := r.db.Where("id = ?", userID).First(&user).Error
	return &user, err
}

func (r *salesHistoryRepository) GetCompanySetting(ctx context.Context) (*entity.CompanySetting, error) {
	var setting entity.CompanySetting
	if err := r.db.WithContext(ctx).First(&setting).Error; err != nil {
		return nil, err
	}
	return &setting, nil
}