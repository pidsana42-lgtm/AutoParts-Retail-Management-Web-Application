package dashboard

import (
	"context"
	"database/sql"
	"math"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"backend/internal/app/enum"
	dashEntity "backend/internal/app/entity"
	dashDto "backend/internal/app/dto/dashboard"
)

type DashboardRepository interface {
	GetSummaryDataByQuery(ctx context.Context, query dashDto.SummaryQuery) ([]dashEntity.DailySummary, int64, error)
	GetRecentSaleOrders(ctx context.Context, start, end time.Time, limit int) ([]dashEntity.SaleOrder, error)
	GetProductsInStock(ctx context.Context) ([]dashEntity.Product, error)
	GetLastSoldDates(ctx context.Context) (map[uint]time.Time, error)
	GetHistoricalSummaries(ctx context.Context, start, end time.Time) ([]dashEntity.DailySummary, error)
	GetLiveSummaryForDate(ctx context.Context, date time.Time) (*dashEntity.DailySummary, error)
	FinalizeDailySummary(ctx context.Context, date time.Time) error
	GetStockHealth(ctx context.Context) (*dashDto.StockHealthDTO, error)
}

type dashboardRepository struct {
	db *gorm.DB
}

// NewDashboardRepository ใช้สำหรับส่ง gorm.DB เข้ามาตอนเริ่มระบบ
func NewDashboardRepository(db *gorm.DB) DashboardRepository {
	return &dashboardRepository{
		db: db,
	}
}

func (r *dashboardRepository) GetSummaryDataByQuery(ctx context.Context, query dashDto.SummaryQuery) ([]dashEntity.DailySummary, int64, error) {
	var dailysummary []dashEntity.DailySummary
	var total int64

	now := time.Now()
	if query.RefDate != "" {
		if parsed, err := time.ParseInLocation("2006-01-02", query.RefDate, now.Location()); err == nil {
			now = parsed
		}
	}
	daysSinceSunday := int(now.Weekday()) // วันอาทิตย์ ถ้าอยากได้วัยแรกคือวันจันทร์ให้ daysSinceMonday := int(now.Weekday()) - 1 และใช้การคำนวณอีกวิธีนึง
	startOfWeek := time.Date(now.Year(), now.Month(), now.Day()-daysSinceSunday, 0, 0, 0, 0, now.Location())
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
	startMonthOfQuarter := time.Month(((int(now.Month()) - 1) / 3) * 3 + 1)
	startOfQuarter := time.Date(now.Year(), startMonthOfQuarter, 1, 0, 0, 0, 0, now.Location())
	startOfYear := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, now.Location())

	dbQuery := r.db.WithContext(ctx).Model(&dashEntity.DailySummary{})

	if query.SummaryDate != "" {
		dbQuery = dbQuery.Where("summary_date = ?", query.SummaryDate)
	}
	if query.Weekly != "" {
		endOfWeek := startOfWeek.AddDate(0, 0, 7) 
		dbQuery = dbQuery.Where("summary_date >= ? AND summary_date < ?", startOfWeek, endOfWeek)
	}
	if query.Monthly != "" {
		endOfMonth := startOfMonth.AddDate(0, 1, 0)
		dbQuery = dbQuery.Where("summary_date >= ? AND summary_date < ?", startOfMonth, endOfMonth)
	}
	if query.Quarterly != "" {
		endOfQuarter := startOfQuarter.AddDate(0, 3, 0)
		dbQuery = dbQuery.Where("summary_date >= ? AND summary_date < ?", startOfQuarter, endOfQuarter)
	}
	if query.Yearly != "" {
		endOfYear := startOfYear.AddDate(1, 0, 0)
		dbQuery = dbQuery.Where("summary_date >= ? AND summary_date < ?", startOfYear, endOfYear)
	}
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	err := dbQuery.
		Order("summary_date DESC").
		Find(&dailysummary).Error

	return dailysummary, total, err
}

func (r *dashboardRepository) GetRecentSaleOrders(ctx context.Context, start, end time.Time, limit int) ([]dashEntity.SaleOrder, error) {
	var orders []dashEntity.SaleOrder
	err := r.db.WithContext(ctx).
		Preload("PaymentMethod").
		Where("created_at >= ? AND created_at < ?", start, end).
		Order("created_at desc").
		Limit(limit).
		Find(&orders).Error
	return orders, err
}

type lastSoldRow struct {
	ProductID uint
	LastSold  time.Time
}

func (r *dashboardRepository) GetProductsInStock(ctx context.Context) ([]dashEntity.Product, error) {
	var products []dashEntity.Product
	err := r.db.WithContext(ctx).
		Preload("Unit").
		Where("quantity > 0").
		Find(&products).Error
	return products, err
}

func (r *dashboardRepository) GetLastSoldDates(ctx context.Context) (map[uint]time.Time, error) {
	type lastSoldRow struct {
		ProductID uint
		LastSold  time.Time
	}
	var rows []lastSoldRow
	err := r.db.WithContext(ctx).
		Table("sale_order_items").
		Select("sale_order_items.product_id AS product_id, MAX(sale_orders.created_at) AS last_sold").
		Joins("JOIN sale_orders ON sale_orders.id = sale_order_items.order_id AND sale_orders.deleted_at IS NULL").
		Where("sale_order_items.deleted_at IS NULL AND sale_orders.status = ?", "completed").
		Group("sale_order_items.product_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uint]time.Time, len(rows))
	for _, row := range rows {
		result[row.ProductID] = row.LastSold
	}
	return result, nil
}

var revenueCountedStatuses = []string{
	string(enum.OrderCompleted),
	string(enum.OrderReturned),
	string(enum.OrderRefunded),
	string(enum.OrderClaimed),
}

var debtExcludedStatuses = []string{
	string(enum.OrderCancelled),
	string(enum.OrderRefunded),
}

// calculateSummaryForDate คือ core logic เดียวที่ใช้ทั้งตอนอ่านสด (วันนี้) และตอน cron finalize (เมื่อวาน)
func (r *dashboardRepository) calculateSummaryForDate(ctx context.Context, date time.Time) (*dashEntity.DailySummary, error) {
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	end := start.AddDate(0, 0, 1)

	summary := &dashEntity.DailySummary{SummaryDate: start}
	db := r.db.WithContext(ctx)

	// 1) ยอดขาย + จำนวนออเดอร์
	type orderAgg struct {
		TotalOrders  int
		TotalRevenue float64
	}
	var oa orderAgg
	if err := db.Model(&dashEntity.SaleOrder{}).
		Select("COUNT(*) AS total_orders, COALESCE(SUM(total_amount),0) AS total_revenue").
		Where("order_date >= ? AND order_date < ? AND status IN ? AND deleted_at IS NULL", start, end, revenueCountedStatuses).
		Scan(&oa).Error; err != nil {
		return nil, err
	}
	summary.TotalOrders = oa.TotalOrders
	summary.TotalRevenue = oa.TotalRevenue

	// 2) จำนวนชิ้น + ต้นทุน
	type itemAgg struct {
		TotalQty  int
		TotalCost float64
	}
	var ia itemAgg
	if err := db.Table("sale_order_items").
		Select("COALESCE(SUM(sale_order_items.qty),0) AS total_qty, COALESCE(SUM(sale_order_items.cost_price * sale_order_items.qty),0) AS total_cost").
		Joins("JOIN sale_orders ON sale_orders.id = sale_order_items.order_id AND sale_orders.deleted_at IS NULL").
		Where("sale_order_items.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ? AND sale_orders.status IN ?", start, end, revenueCountedStatuses).
		Scan(&ia).Error; err != nil {
		return nil, err
	}
	summary.TotalItemsSold = ia.TotalQty
	summary.TotalCost = ia.TotalCost
	summary.GrossProfit = summary.TotalRevenue - summary.TotalCost
	if summary.TotalRevenue > 0 {
		summary.MarginPercent = summary.GrossProfit / summary.TotalRevenue * 100
	}

	// 3) แยกตามช่องทางชำระเงิน (เงินสด/โอน/เครดิต)
	type methodAgg struct {
		MethodName string
		Amount     float64
	}
	var methodAggs []methodAgg
	if err := db.Table("sale_orders").
		Select("payment_methods.method_name AS method_name, COALESCE(SUM(sale_orders.total_amount),0) AS amount").
		Joins("JOIN payment_methods ON payment_methods.id = sale_orders.payment_method_id").
		Where("sale_orders.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ? AND sale_orders.status IN ?", start, end, revenueCountedStatuses).
		Group("payment_methods.method_name").
		Scan(&methodAggs).Error; err != nil {
		return nil, err
	}
	for _, m := range methodAggs {
		switch m.MethodName {
		case enum.PaymentMethodCash:
			summary.CashAmount = m.Amount
		case enum.PaymentMethodQR:
			summary.TransferAmount = m.Amount
		case enum.PaymentMethodCredit:
			summary.CreditAmount = m.Amount
		}
	}

	// 4) แยกตามประเภทลูกค้า (walkin/garage/corporate)
	type customerAgg struct {
		TypeName sql.NullString
		Amount   float64
	}
	var custAggs []customerAgg
	if err := db.Table("sale_orders").
		Select("customer_types.type_name AS type_name, COALESCE(SUM(sale_orders.total_amount),0) AS amount").
		Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
		Joins("LEFT JOIN customer_types ON customer_types.id = customers.customer_type_id").
		Where("sale_orders.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ? AND sale_orders.status IN ?", start, end, revenueCountedStatuses).
		Group("customer_types.type_name").
		Scan(&custAggs).Error; err != nil {
		return nil, err
	}
	for _, c := range custAggs {
		typeName := ""
		if c.TypeName.Valid {
			typeName = c.TypeName.String
		}
		switch typeName {
		case "ลูกค้าอู่":
			summary.GarageCustomerAmount = c.Amount
		case "ลูกค้าบริษัท":
			summary.CorporateCustomerAmount = c.Amount
		default:
			// CustomerID = nil (ว่าง) หรือ "ลูกค้าทั่วไป" ถือเป็น walk-in ทั้งคู่
			summary.WalkinCustomerAmount += c.Amount
		}
	}

	// 5) ยอดคืนสินค้า (นับตาม ApprovedAt เท่านั้น)
	var returnAmount float64
	if err := db.Model(&dashEntity.SalesReturn{}).
		Select("COALESCE(SUM(refund_amount),0)").
		Where("approved_at >= ? AND approved_at < ? AND deleted_at IS NULL", start, end).
		Scan(&returnAmount).Error; err != nil {
		return nil, err
	}
	summary.ReturnAmount = returnAmount

	// 6) ยอดเก็บหนี้ได้ในวันนี้ (Payment + PaymentRepayment)
	var paymentCollected float64
	if err := db.Model(&dashEntity.Payment{}).
		Select("COALESCE(SUM(amount),0)").
		Where("paid_at >= ? AND paid_at < ? AND deleted_at IS NULL", start, end).
		Scan(&paymentCollected).Error; err != nil {
		return nil, err
	}
	var repaymentCollected float64
	if err := db.Model(&dashEntity.PaymentRepayment{}).
		Select("COALESCE(SUM(amount_paid),0)").
		Where("paid_at >= ? AND paid_at < ? AND deleted_at IS NULL", start, end).
		Scan(&repaymentCollected).Error; err != nil {
		return nil, err
	}
	summary.CollectedDebtAmount = paymentCollected + repaymentCollected

	// 7) Snapshot หนี้คงค้าง ณ ตอนนี้ (ไม่ผูกกับ order_date ของวันนั้น)
	now := time.Now()
	var overdueCount int64
	if err := db.Model(&dashEntity.SaleOrder{}).
		Where("deleted_at IS NULL AND balance_due > 0 AND due_date IS NOT NULL AND due_date < ? AND status NOT IN ?", now, debtExcludedStatuses).
		Count(&overdueCount).Error; err != nil {
		return nil, err
	}
	summary.OverdueDebtCount = int(overdueCount)

	var outstanding float64
	if err := db.Model(&dashEntity.SaleOrder{}).
		Select("COALESCE(SUM(balance_due),0)").
		Where("deleted_at IS NULL AND balance_due > 0 AND status NOT IN ?", debtExcludedStatuses).
		Scan(&outstanding).Error; err != nil {
		return nil, err
	}
	summary.TotalOutstandingDebt = outstanding

	return summary, nil
}

// GetLiveSummaryForDate ใช้แสดงผล "วันนี้" แบบ real-time ไม่บันทึกลง DB
func (r *dashboardRepository) GetLiveSummaryForDate(ctx context.Context, date time.Time) (*dashEntity.DailySummary, error) {
	return r.calculateSummaryForDate(ctx, date)
}

// FinalizeDailySummary ใช้โดย cron ตอนเที่ยงคืน เพื่อปิดยอดของวันที่ผ่านไปแล้วและ upsert ลงตาราง
func (r *dashboardRepository) FinalizeDailySummary(ctx context.Context, date time.Time) error {
	summary, err := r.calculateSummaryForDate(ctx, date)
	if err != nil {
		return err
	}
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "summary_date"}},
			UpdateAll: true,
		}).
		Create(summary).Error
}

func (r *dashboardRepository) GetStockHealth(ctx context.Context) (*dashDto.StockHealthDTO, error) {
	type healthRow struct {
		TotalProducts   int64
		HealthyCount    int64
		LowStockCount   int64
		OutOfStockCount int64
	}
	var row healthRow
	err := r.db.WithContext(ctx).
		Model(&dashEntity.Product{}).
		Select(`
			COUNT(*) AS total_products,
			COUNT(CASE WHEN quantity > limit_quantity THEN 1 END) AS healthy_count,
			COUNT(CASE WHEN quantity > 0 AND quantity <= limit_quantity THEN 1 END) AS low_stock_count,
			COUNT(CASE WHEN quantity = 0 THEN 1 END) AS out_of_stock_count
		`).
		Where("deleted_at IS NULL AND is_active = true").
		Scan(&row).Error
	if err != nil {
		return nil, err
	}
	healthPct := float64(0)
	if row.TotalProducts > 0 {
		healthPct = math.Round(float64(row.HealthyCount) / float64(row.TotalProducts) * 100)
	}
	return &dashDto.StockHealthDTO{
		TotalProducts:   row.TotalProducts,
		HealthyCount:    row.HealthyCount,
		LowStockCount:   row.LowStockCount,
		OutOfStockCount: row.OutOfStockCount,
		HealthPercent:   healthPct,
	}, nil
}

// GetHistoricalSummaries อ่านจาก daily_summary ตรงๆ (ข้อมูลนิ่งแล้ว ไม่ query สด) เติมวันที่ขาดด้วย 0
func (r *dashboardRepository) GetHistoricalSummaries(ctx context.Context, start, end time.Time) ([]dashEntity.DailySummary, error) {
	var result []dashEntity.DailySummary
	err := r.db.WithContext(ctx).Raw(`
		SELECT
			gs::date AS summary_date,
			COALESCE(ds.total_orders, 0) AS total_orders,
			COALESCE(ds.total_items_sold, 0) AS total_items_sold,
			COALESCE(ds.overdue_debt_count, 0) AS overdue_debt_count,
			COALESCE(ds.total_revenue, 0) AS total_revenue,
			COALESCE(ds.total_cost, 0) AS total_cost,
			COALESCE(ds.gross_profit, 0) AS gross_profit,
			COALESCE(ds.margin_percent, 0) AS margin_percent,
			COALESCE(ds.cash_amount, 0) AS cash_amount,
			COALESCE(ds.transfer_amount, 0) AS transfer_amount,
			COALESCE(ds.credit_amount, 0) AS credit_amount,
			COALESCE(ds.walkin_customer_amount, 0) AS walkin_customer_amount,
			COALESCE(ds.garage_customer_amount, 0) AS garage_customer_amount,
			COALESCE(ds.corporate_customer_amount, 0) AS corporate_customer_amount,
			COALESCE(ds.return_amount, 0) AS return_amount,
			COALESCE(ds.collected_debt_amount, 0) AS collected_debt_amount,
			COALESCE(ds.total_outstanding_debt, 0) AS total_outstanding_amount
		FROM generate_series(?::date, (?::date - interval '1 day'), interval '1 day') AS gs
		LEFT JOIN daily_summary ds ON ds.summary_date = gs::date AND ds.deleted_at IS NULL
		ORDER BY gs DESC
	`, start, end).Scan(&result).Error
	return result, err
}