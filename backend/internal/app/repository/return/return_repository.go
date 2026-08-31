package returns

import (
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	reDto "backend/internal/app/dto/return"
	reEntity "backend/internal/app/entity"
	"backend/internal/app/enum"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ReturnRepository interface {
	GetStatusCounts(search string) ([]reDto.ReturnStatusCount, error)
	GetList(search, status string, limit, offset int) ([]reEntity.SalesReturn, int64, error)
	SearchReturnableSaleOrders(keyword string) ([]reEntity.SaleOrder, error)
	GetReturnByID(id uint) (*reEntity.SalesReturn, error)
	CreateReturn(returnItem *reEntity.SalesReturn, items []reEntity.SalesReturnItem) error
	ApproveReturn(id uint, approvedBy uint) error
	ProcessRefund(id uint, processedBy uint) error
	UpdateReturn(returnItem *reEntity.SalesReturn) error
	DeleteReturn(id uint) error
}

var ErrOrderInProgress = errors.New("sale order already has an active claim or return")
var ErrOrderNotCompleted = errors.New("only completed sale orders can be returned")
var ErrReturnAlreadyProcessed = errors.New("return has already been processed")
var ErrReturnNotPending = errors.New("only pending returns can be approved or rejected")
var ErrInvalidRefundMethod = errors.New("invalid refund method")
var ErrReturnQuantityExceedsOrder = errors.New("return quantity exceeds the sold quantity")
var ErrRefundAmountExceedsOrder = errors.New("refund amount exceeds the sale order amount")
var ErrRefundRequiresCustomer = errors.New("store credit refund requires a registered customer")
var ErrReturnNotApproved = errors.New("only approved returns can be refunded")

type returnRepository struct {
	db *gorm.DB
}

func NewReturnRepository(db *gorm.DB) ReturnRepository {
	return &returnRepository{db: db}
}

func generateReturnNumber(tx *gorm.DB) (string, error) {
	currentYear := time.Now().Format("2006")
	prefix := fmt.Sprintf("RTN-%s-", currentYear)

	var latestNumber string
	err := tx.Unscoped().Model(&reEntity.SalesReturn{}).
		Where("return_number LIKE ?", prefix+"%").
		Order("return_number DESC").
		Limit(1).
		Pluck("return_number", &latestNumber).Error

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return "", err
	}

	nextSeq := 1
	if latestNumber != "" {
		parts := strings.Split(latestNumber, "-")
		if len(parts) == 3 {
			if lastSeq, convErr := strconv.Atoi(parts[2]); convErr == nil {
				nextSeq = lastSeq + 1
			}
		}
	}

	return fmt.Sprintf("RTN-%s-%04d", currentYear, nextSeq), nil
}

func (r *returnRepository) GetStatusCounts(search string) ([]reDto.ReturnStatusCount, error) {
	var counts []reDto.ReturnStatusCount
	q := r.db.Model(&reEntity.SalesReturn{})

	if strings.TrimSpace(search) != "" {
		term := "%" + strings.TrimSpace(search) + "%"
		q = q.Joins("LEFT JOIN sale_orders ON sale_orders.id = sales_returns.original_order_id AND sale_orders.deleted_at IS NULL").
			Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id AND customers.deleted_at IS NULL").
			Where("sales_returns.return_number ILIKE ? OR sales_returns.reason ILIKE ? OR sales_returns.note ILIKE ? OR sale_orders.order_number ILIKE ? OR customers.customer_name ILIKE ? OR sale_orders.customer_name_temp ILIKE ?", term, term, term, term, term, term)
	}

	err := q.Select("status, COUNT(*) as count").Group("status").Scan(&counts).Error
	return counts, err
}

func (r *returnRepository) GetList(search, status string, limit, offset int) ([]reEntity.SalesReturn, int64, error) {
	var returns []reEntity.SalesReturn
	var count int64

	q := r.db.Model(&reEntity.SalesReturn{})

	if strings.TrimSpace(search) != "" {
		term := "%" + strings.TrimSpace(search) + "%"
		q = q.Joins("LEFT JOIN sale_orders ON sale_orders.id = sales_returns.original_order_id AND sale_orders.deleted_at IS NULL").
			Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id AND customers.deleted_at IS NULL").
			Where("sales_returns.return_number ILIKE ? OR sales_returns.reason ILIKE ? OR sales_returns.note ILIKE ? OR sale_orders.order_number ILIKE ? OR customers.customer_name ILIKE ? OR sale_orders.customer_name_temp ILIKE ?", term, term, term, term, term, term)
	}
	if status != "" {
		q = q.Where("sales_returns.status = ?", status)
	}

	if err := q.Count(&count).Error; err != nil {
		return nil, 0, err
	}

	err := q.Preload("OriginalOrder").
		Preload("OriginalOrder.Customer").
		Preload("OriginalOrder.CreatedBy").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Preload("SalesReturnItems").
		Preload("SalesReturnItems.Product").
		Order("sales_returns.created_at DESC").
		Limit(limit).
		Offset(offset).
		Find(&returns).Error

	return returns, count, err
}

func (r *returnRepository) SearchReturnableSaleOrders(keyword string) ([]reEntity.SaleOrder, error) {
	orders := make([]reEntity.SaleOrder, 0)
	term := "%" + strings.TrimSpace(keyword) + "%"

	err := r.db.
		Preload("Customer").
		Preload("CreatedBy").
		Preload("Items").
		Preload("Items.Product").
		Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id AND customers.deleted_at IS NULL").
		Where("sale_orders.deleted_at IS NULL").
		Where("LOWER(TRIM(sale_orders.status)) = ?", string(enum.OrderCompleted)).
		Where(`NOT EXISTS (
			SELECT 1 FROM sales_returns sr
			WHERE sr.original_order_id = sale_orders.id
			  AND sr.deleted_at IS NULL
			  AND LOWER(TRIM(COALESCE(sr.status, ''))) <> 'rejected'
		)`).
		Where(`NOT EXISTS (
			SELECT 1 FROM customer_claims cc
			WHERE cc.original_order_id = sale_orders.id
			  AND cc.deleted_at IS NULL
			  AND LOWER(TRIM(COALESCE(cc.status, ''))) <> 'rejected'
		)`).
		Where(
			"sale_orders.order_number ILIKE ? OR customers.customer_name ILIKE ? OR sale_orders.customer_name_temp ILIKE ? OR sale_orders.customer_phone_temp ILIKE ?",
			term, term, term, term,
		).
		Order("sale_orders.created_at DESC").
		Limit(20).
		Find(&orders).Error

	return orders, err
}

func (r *returnRepository) GetReturnByID(id uint) (*reEntity.SalesReturn, error) {
	var returnItem reEntity.SalesReturn

	err := r.db.
		Preload("OriginalOrder").
		Preload("OriginalOrder.Customer").
		Preload("OriginalOrder.CreatedBy").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Preload("SalesReturnItems").
		Preload("SalesReturnItems.Product").
		First(&returnItem, id).Error

	if err != nil {
		return nil, err
	}
	return &returnItem, nil
}

func (r *returnRepository) CreateReturn(returnItem *reEntity.SalesReturn, items []reEntity.SalesReturnItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order reEntity.SaleOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, returnItem.OriginalOrderID).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(string(order.Status))) != string(enum.OrderCompleted) {
			return ErrOrderNotCompleted
		}

		orderItems := make([]reEntity.SaleOrderItem, 0)
		if err := tx.Where("order_id = ?", order.ID).Find(&orderItems).Error; err != nil {
			return err
		}
		if err := validateReturnItems(items, orderItems); err != nil {
			return err
		}

		var activeReturns int64
		if err := tx.Model(&reEntity.SalesReturn{}).
			Where("original_order_id = ? AND deleted_at IS NULL AND LOWER(TRIM(COALESCE(status, ''))) <> 'rejected'", returnItem.OriginalOrderID).
			Count(&activeReturns).Error; err != nil {
			return err
		}

		var activeClaims int64
		if err := tx.Model(&reEntity.CustomerClaim{}).
			Where("original_order_id = ? AND deleted_at IS NULL AND LOWER(TRIM(COALESCE(status, ''))) <> 'rejected'", returnItem.OriginalOrderID).
			Count(&activeClaims).Error; err != nil {
			return err
		}
		if activeReturns > 0 || activeClaims > 0 {
			return ErrOrderInProgress
		}

		if returnItem.ReturnNumber == "" {
			num, err := generateReturnNumber(tx)
			if err != nil {
				return err
			}
			returnItem.ReturnNumber = num
		}

		if err := tx.Create(returnItem).Error; err != nil {
			return err
		}

		if len(items) > 0 {
			for i := range items {
				items[i].SalesReturnID = returnItem.ID
				if items[i].Subtotal <= 0 {
					items[i].Subtotal = float64(items[i].Quantity) * items[i].UnitPrice
				}
				if err := tx.Create(&items[i]).Error; err != nil {
					return err
				}
			}
			returnItem.SalesReturnItems = items
		}

		if returnItem.Status == enum.ReturnApproved {
			approvedBy := returnItem.CreatedBy
			if returnItem.ApprovedBy != nil && *returnItem.ApprovedBy != 0 {
				approvedBy = *returnItem.ApprovedBy
			}
			if err := r.applyApprovedReturn(tx, returnItem, &order, items, approvedBy); err != nil {
				return err
			}
		}

		return nil
	})
}

func validateReturnItems(items []reEntity.SalesReturnItem, orderItems []reEntity.SaleOrderItem) error {
	ordered := make(map[uint]int, len(orderItems))
	for _, item := range orderItems {
		ordered[item.ProductID] += item.Qty
	}

	returned := make(map[uint]int, len(items))
	for _, item := range items {
		if item.Quantity <= 0 {
			return ErrReturnQuantityExceedsOrder
		}
		returned[item.ProductID] += item.Quantity
	}
	for productID, quantity := range returned {
		if ordered[productID] < quantity {
			return ErrReturnQuantityExceedsOrder
		}
	}
	return nil
}

func refundPaymentMethodID(method string) (uint, error) {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "CASH":
		return 1, nil
	case "TRANSFER", "QR", "QRCODE":
		return 2, nil
	case "STORE_CREDIT", "CREDIT":
		return 3, nil
	default:
		return 0, ErrInvalidRefundMethod
	}
}

func (r *returnRepository) applyApprovedReturn(tx *gorm.DB, returnItem *reEntity.SalesReturn, order *reEntity.SaleOrder, items []reEntity.SalesReturnItem, approvedBy uint) error {
	if approvedBy == 0 {
		approvedBy = returnItem.CreatedBy
	}
	if approvedBy == 0 {
		approvedBy = 1
	}

	if returnItem.RefundAmount <= 0 {
		return errors.New("refund amount must be greater than zero")
	}
	if returnItem.RefundAmount > order.TotalAmount {
		return ErrRefundAmountExceedsOrder
	}

	now := time.Now()
	approvedByPtr := approvedBy
	if err := tx.Model(&reEntity.SalesReturn{}).Where("id = ?", returnItem.ID).Updates(map[string]interface{}{
		"status":      enum.ReturnApproved,
		"approved_at": now,
		"approved_by": approvedBy,
	}).Error; err != nil {
		return err
	}

	if err := tx.Model(&reEntity.SaleOrder{}).Where("id = ?", order.ID).Updates(map[string]interface{}{
		"status": enum.OrderReturned,
	}).Error; err != nil {
		return err
	}

	// Keep the approved metadata in memory for callers that reuse the entity.
	returnItem.Status = enum.ReturnApproved
	returnItem.ApprovedAt = &now
	returnItem.ApprovedBy = &approvedByPtr
	return nil
}

func (r *returnRepository) updateDailySummaryForRefund(tx *gorm.DB, order *reEntity.SaleOrder, amount float64) error {
	saleDate := order.OrderDate
	if saleDate.IsZero() {
		saleDate = order.CreatedAt
	}
	summaryDate := time.Date(saleDate.Year(), saleDate.Month(), saleDate.Day(), 0, 0, 0, 0, saleDate.Location())
	var totalRevenue float64
	if err := tx.Model(&reEntity.SaleOrder{}).
		Select("COALESCE(SUM(total_amount),0)").
		Where("order_date >= ? AND order_date < ? AND status IN ? AND deleted_at IS NULL", summaryDate, summaryDate.AddDate(0, 0, 1), []enum.OrderStatus{
			enum.OrderCompleted,
			enum.OrderReturned,
			enum.OrderRefunded,
			enum.OrderClaimed,
		}).
		Scan(&totalRevenue).Error; err != nil {
		return err
	}

	// หา bucket ช่องทางชำระเงิน/ประเภทลูกค้าของออเดอร์ต้นทาง เพื่อหักยอดคืนออกจาก breakdown ให้ตรงกับ bucket ที่เคยนับไว้ตอนขาย
	methodColumn := ""
	if order.PaymentMethodID != nil {
		var pm reEntity.PaymentMethod
		if err := tx.First(&pm, *order.PaymentMethodID).Error; err == nil {
			switch pm.MethodName {
			case enum.PaymentMethodCash:
				methodColumn = "cash_amount"
			case enum.PaymentMethodQR:
				methodColumn = "transfer_amount"
			case enum.PaymentMethodCredit:
				methodColumn = "credit_amount"
			}
		}
	}

	customerColumn := "walkin_customer_amount"
	if order.CustomerID != nil {
		var cust reEntity.Customer
		if err := tx.Preload("CustomerType").First(&cust, *order.CustomerID).Error; err == nil {
			switch cust.CustomerType.TypeName {
			case "GARAGE":
				customerColumn = "garage_customer_amount"
			case "WHOLESALE":
				customerColumn = "corporate_customer_amount"
			}
		}
	}

	var summary reEntity.DailySummary
	err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("summary_date = ?", summaryDate).First(&summary).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		newSummary := &reEntity.DailySummary{
			SummaryDate:  summaryDate,
			TotalRevenue: totalRevenue,
			ReturnAmount: amount,
			NetRevenue:   totalRevenue - amount,
		}
		switch methodColumn {
		case "cash_amount":
			newSummary.CashAmount = -amount
		case "transfer_amount":
			newSummary.TransferAmount = -amount
		case "credit_amount":
			newSummary.CreditAmount = -amount
		}
		switch customerColumn {
		case "garage_customer_amount":
			newSummary.GarageCustomerAmount = -amount
		case "corporate_customer_amount":
			newSummary.CorporateCustomerAmount = -amount
		default:
			newSummary.WalkinCustomerAmount = -amount
		}
		return tx.Create(newSummary).Error
	}
	if err != nil {
		return err
	}
	newReturnAmount := summary.ReturnAmount + amount
	if summary.TotalRevenue == 0 {
		summary.TotalRevenue = totalRevenue
	}
	updates := map[string]interface{}{
		"return_amount": newReturnAmount,
		"net_revenue":   summary.TotalRevenue - newReturnAmount,
	}
	if methodColumn != "" {
		updates[methodColumn] = gorm.Expr(methodColumn + " - ?", amount)
	}
	updates[customerColumn] = gorm.Expr(customerColumn + " - ?", amount)
	return tx.Model(&reEntity.DailySummary{}).
		Where("id = ?", summary.ID).
		Updates(updates).Error
}

func (r *returnRepository) ProcessRefund(id uint, processedBy uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var returnItem reEntity.SalesReturn
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&returnItem, id).Error; err != nil {
			return err
		}
		if returnItem.Status == enum.ReturnRefunded {
			return nil
		}
		if returnItem.Status != enum.ReturnApproved {
			return ErrReturnNotApproved
		}

		methodID, err := refundPaymentMethodID(returnItem.RefundMethod)
		if err != nil {
			return err
		}
		var order reEntity.SaleOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, returnItem.OriginalOrderID).Error; err != nil {
			return err
		}
		if methodID == 3 && order.CustomerID == nil {
			return ErrRefundRequiresCustomer
		}
		if returnItem.RefundAmount <= 0 {
			return errors.New("refund amount must be greater than zero")
		}
		if returnItem.RefundAmount > order.TotalAmount {
			return ErrRefundAmountExceedsOrder
		}
		if processedBy == 0 {
			processedBy = returnItem.CreatedBy
		}
		if processedBy == 0 {
			processedBy = 1
		}

		now := time.Now()
		var items []reEntity.SalesReturnItem
		if err := tx.Where("sales_return_id = ?", returnItem.ID).Find(&items).Error; err != nil {
			return err
		}
		returnedByProduct := make(map[uint]int, len(items))
		for _, item := range items {
			returnedByProduct[item.ProductID] += item.Quantity
		}
		for productID, quantity := range returnedByProduct {
			result := tx.Model(&reEntity.Product{}).
				Where("id = ?", productID).
				UpdateColumn("quantity", gorm.Expr("quantity + ?", quantity))
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 0 {
				return gorm.ErrRecordNotFound
			}
		}
		for _, item := range items {
			saleOrderID := order.ID
			movement := &reEntity.StockMovement{
				Movement_Type:     "RETURN",
				Quantity:          item.Quantity,
				Movement_DateTime: now,
				Note:              fmt.Sprintf("Return %s", returnItem.ReturnNumber),
				ProductID:         item.ProductID,
				UserID:            &processedBy,
				SaleOrderID:       &saleOrderID,
			}
			if err := tx.Create(movement).Error; err != nil {
				return err
			}
		}

		returnID := returnItem.ID
		refundPayment := &reEntity.Payment{
			OrderID:         order.ID,
			PaymentMethodID: methodID,
			Amount:          -returnItem.RefundAmount,
			ReceivedAmount:  0,
			ChangeAmount:    0,
			ReferenceNumber: "REFUND-" + returnItem.ReturnNumber,
			PaidAt:          &now,
			ReceivedByID:    processedBy,
			ReturnID:        &returnID,
		}
		if err := tx.Create(refundPayment).Error; err != nil {
			return err
		}

		if order.PaymentMethodID != nil {
			var paymentMethod reEntity.PaymentMethod
			if err := tx.First(&paymentMethod, *order.PaymentMethodID).Error; err != nil {
				return err
			}
			if paymentMethod.IsCredit && order.CustomerID != nil {
				if err := tx.Model(&reEntity.Customer{}).
					Where("id = ?", *order.CustomerID).
					UpdateColumn("current_debt_amount", gorm.Expr("GREATEST(current_debt_amount - ?, 0)", returnItem.RefundAmount)).Error; err != nil {
					return err
				}
			}
		}

		if err := tx.Model(&reEntity.SalesReturn{}).Where("id = ?", returnItem.ID).Updates(map[string]interface{}{
			"status":      enum.ReturnRefunded,
			"refunded_at": now,
			"refunded_by": processedBy,
		}).Error; err != nil {
			return err
		}
		return r.updateDailySummaryForRefund(tx, &order, returnItem.RefundAmount)
	})
}

func (r *returnRepository) ApproveReturn(id uint, approvedBy uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var returnItem reEntity.SalesReturn
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&returnItem, id).Error; err != nil {
			return err
		}
		if returnItem.Status == enum.ReturnApproved {
			return nil
		}
		if returnItem.Status != enum.ReturnPending {
			return ErrReturnAlreadyProcessed
		}

		var order reEntity.SaleOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, returnItem.OriginalOrderID).Error; err != nil {
			return err
		}
		if strings.ToLower(strings.TrimSpace(string(order.Status))) != string(enum.OrderCompleted) {
			return ErrOrderNotCompleted
		}

		items := make([]reEntity.SalesReturnItem, 0)
		if err := tx.Where("sales_return_id = ?", returnItem.ID).Find(&items).Error; err != nil {
			return err
		}
		orderItems := make([]reEntity.SaleOrderItem, 0)
		if err := tx.Where("order_id = ?", order.ID).Find(&orderItems).Error; err != nil {
			return err
		}
		if err := validateReturnItems(items, orderItems); err != nil {
			return err
		}

		return r.applyApprovedReturn(tx, &returnItem, &order, items, approvedBy)
	})
}

func (r *returnRepository) UpdateReturn(returnItem *reEntity.SalesReturn) error {
	return r.db.Save(returnItem).Error
}

func (r *returnRepository) DeleteReturn(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("sales_return_id = ?", id).Delete(&reEntity.SalesReturnItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&reEntity.SalesReturn{}, id).Error
	})
}
