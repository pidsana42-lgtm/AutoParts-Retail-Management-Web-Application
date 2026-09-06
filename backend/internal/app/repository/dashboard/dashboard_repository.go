package dashboard

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"

	dashDto "backend/internal/app/dto/dashboard"
	dashEntity "backend/internal/app/entity"
	"backend/internal/app/enum"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DashboardRepository interface {
	GetSummaryDataByQuery(ctx context.Context, query dashDto.SummaryQuery) ([]dashEntity.DailySummary, int64, error)
	GetRecentSaleOrders(ctx context.Context, start, end time.Time, page, pageSize int) ([]dashEntity.SaleOrder, int64, error)
	GetProductsInStock(ctx context.Context) ([]dashEntity.Product, error)
	GetLastSoldDates(ctx context.Context) (map[uint]time.Time, error)
	GetHistoricalSummaries(ctx context.Context, start, end time.Time) ([]dashEntity.DailySummary, error)
	GetLiveSummaryForDate(ctx context.Context, date time.Time) (*dashEntity.DailySummary, error)
	FinalizeDailySummary(ctx context.Context, date time.Time) error
	GetStockHealth(ctx context.Context) (*dashDto.StockHealthDTO, error)
	GetTopSellers(ctx context.Context, start, end time.Time, limit int) ([]dashDto.TopSellerDTO, error)
	GetDebtAging(ctx context.Context, query dashDto.DebtAgingQuery) ([]dashDto.DebtAgingItemDTO, int64, error)
	GetTotalDebtors(ctx context.Context) (int64, error)
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
	startMonthOfQuarter := time.Month(((int(now.Month())-1)/3)*3 + 1)
	startOfQuarter := time.Date(now.Year(), startMonthOfQuarter, 1, 0, 0, 0, 0, now.Location())
	startOfYear := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, now.Location())

	dbQuery := r.db.WithContext(ctx).Model(&dashEntity.DailySummary{})

	if query.SummaryDate != "" {
		dbQuery = dbQuery.Where("summary_date = ?", query.SummaryDate)
	}
	if query.StartDate != "" && query.EndDate != "" {
		dbQuery = dbQuery.Where("summary_date >= ? AND summary_date <= ?", query.StartDate, query.EndDate)
	} else if query.StartDate != "" {
		dbQuery = dbQuery.Where("summary_date >= ?", query.StartDate)
	} else if query.EndDate != "" {
		dbQuery = dbQuery.Where("summary_date <= ?", query.EndDate)
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

func (r *dashboardRepository) GetRecentSaleOrders(ctx context.Context, start, end time.Time, page, pageSize int) ([]dashEntity.SaleOrder, int64, error) {
	var orders []dashEntity.SaleOrder
	var total int64

	baseQuery := r.db.WithContext(ctx).
		Model(&dashEntity.SaleOrder{}).
		Where("created_at >= ? AND created_at < ?", start, end)
	if err := baseQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	err := r.db.WithContext(ctx).
		Preload("PaymentMethod").
		Where("created_at >= ? AND created_at < ?", start, end).
		Order("created_at desc").
		Offset(offset).
		Limit(pageSize).
		Find(&orders).Error
	return orders, total, err
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
		case "GARAGE":
			summary.GarageCustomerAmount = c.Amount
		case "WHOLESALE":
			summary.CorporateCustomerAmount = c.Amount
		default:
			// GENERAL หรือ CustomerID = nil (ว่าง) ถือเป็น walk-in ทั้งคู่
			summary.WalkinCustomerAmount += c.Amount
		}
	}

	// 5) ยอดคืนสินค้า (หักกลับไปยังวันที่ขายของใบขายต้นทาง)
	var returnAmount float64
	if err := db.Table("sales_returns").
		Select("COALESCE(SUM(refund_amount),0)").
		Joins("JOIN sale_orders ON sale_orders.id = sales_returns.original_order_id AND sale_orders.deleted_at IS NULL").
		Where("sales_returns.refunded_at IS NOT NULL AND sales_returns.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ?", start, end).
		Scan(&returnAmount).Error; err != nil {
		return nil, err
	}
	summary.ReturnAmount = returnAmount

	// 5b) หักยอดคืนออกจาก breakdown ตามช่องทางชำระเงิน ให้ตรงกับ bucket ของออเดอร์ต้นทาง (ไม่ใช่ refund_method)
	var returnMethodAggs []methodAgg
	if err := db.Table("sales_returns").
		Select("payment_methods.method_name AS method_name, COALESCE(SUM(sales_returns.refund_amount),0) AS amount").
		Joins("JOIN sale_orders ON sale_orders.id = sales_returns.original_order_id AND sale_orders.deleted_at IS NULL").
		Joins("JOIN payment_methods ON payment_methods.id = sale_orders.payment_method_id").
		Where("sales_returns.refunded_at IS NOT NULL AND sales_returns.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ?", start, end).
		Group("payment_methods.method_name").
		Scan(&returnMethodAggs).Error; err != nil {
		return nil, err
	}
	for _, m := range returnMethodAggs {
		switch m.MethodName {
		case enum.PaymentMethodCash:
			summary.CashAmount -= m.Amount
		case enum.PaymentMethodQR:
			summary.TransferAmount -= m.Amount
		case enum.PaymentMethodCredit:
			summary.CreditAmount -= m.Amount
		}
	}

	// 5c) หักยอดคืนออกจาก breakdown ตามประเภทลูกค้า ให้ตรงกับ bucket ของออเดอร์ต้นทาง
	var returnCustAggs []customerAgg
	if err := db.Table("sales_returns").
		Select("customer_types.type_name AS type_name, COALESCE(SUM(sales_returns.refund_amount),0) AS amount").
		Joins("JOIN sale_orders ON sale_orders.id = sales_returns.original_order_id AND sale_orders.deleted_at IS NULL").
		Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
		Joins("LEFT JOIN customer_types ON customer_types.id = customers.customer_type_id").
		Where("sales_returns.refunded_at IS NOT NULL AND sales_returns.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ?", start, end).
		Group("customer_types.type_name").
		Scan(&returnCustAggs).Error; err != nil {
		return nil, err
	}
	for _, c := range returnCustAggs {
		typeName := ""
		if c.TypeName.Valid {
			typeName = c.TypeName.String
		}
		switch typeName {
		case "GARAGE":
			summary.GarageCustomerAmount -= c.Amount
		case "WHOLESALE":
			summary.CorporateCustomerAmount -= c.Amount
		default:
			summary.WalkinCustomerAmount -= c.Amount
		}
	}

	summary.NetRevenue = summary.TotalRevenue - summary.ReturnAmount
	summary.GrossProfit = summary.NetRevenue - summary.TotalCost
	if summary.NetRevenue > 0 {
		summary.MarginPercent = summary.GrossProfit / summary.NetRevenue * 100
	} else {
		summary.MarginPercent = 0
	}

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

func (r *dashboardRepository) GetTopSellers(ctx context.Context, start, end time.Time, limit int) ([]dashDto.TopSellerDTO, error) {
	type row struct {
		ID           uint
		ProductName  string
		Category     string
		TotalSold    int
		TotalRevenue float64
	}
	var rows []row
	err := r.db.WithContext(ctx).
		Table("sale_order_items").
		Select(`
			products.id AS id,
			products.product_name AS product_name,
			COALESCE(categories.category_name, '-') AS category,
			COALESCE(SUM(sale_order_items.qty), 0) AS total_sold,
			COALESCE(SUM(sale_order_items.unit_price * sale_order_items.qty), 0) AS total_revenue
		`).
		Joins("JOIN sale_orders ON sale_orders.id = sale_order_items.order_id AND sale_orders.deleted_at IS NULL").
		Joins("JOIN products ON products.id = sale_order_items.product_id AND products.deleted_at IS NULL").
		Joins("LEFT JOIN categories ON categories.id = products.category_id AND categories.deleted_at IS NULL").
		Where("sale_order_items.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ? AND sale_orders.status IN ?", start, end, revenueCountedStatuses).
		Group("products.id, products.product_name, categories.category_name").
		Order("total_sold DESC").
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}
	result := make([]dashDto.TopSellerDTO, len(rows))
	for i, r := range rows {
		result[i] = dashDto.TopSellerDTO{
			ID:           r.ID,
			ProductName:  r.ProductName,
			Category:     r.Category,
			TotalSold:    r.TotalSold,
			TotalRevenue: r.TotalRevenue,
		}
	}
	return result, nil
}

// GetDebtAging คืนรายชื่อลูกหนี้ที่ยังค้างชำระ พร้อม pagination
func (r *dashboardRepository) GetDebtAging(ctx context.Context, query dashDto.DebtAgingQuery) ([]dashDto.DebtAgingItemDTO, int64, error) {
	page := query.Page
	if page <= 0 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize

	baseWhere := `
		so.deleted_at IS NULL
		AND so.balance_due > 0
		AND so.customer_id IS NOT NULL
		AND so.status NOT IN ('` + string(enum.OrderCancelled) + `','` + string(enum.OrderRefunded) + `')`

	var dateArgs []interface{}
	dateFilter := ""
	if query.StartDate != "" {
		dateFilter += " AND so.order_date >= ?"
		dateArgs = append(dateArgs, query.StartDate)
	}
	if query.EndDate != "" {
		dateFilter += " AND so.order_date < (? ::date + interval '1 day')"
		dateArgs = append(dateArgs, query.EndDate)
	}

	// Build HAVING clause for status and age-day filters (aggregates — cannot go in WHERE)
	statusExpr := `CASE WHEN BOOL_OR(so.due_date IS NOT NULL AND so.due_date < NOW()) THEN 'เกินกำหนด' ELSE 'ทยอยชำระ' END`
	ageExpr := `(CURRENT_DATE - MIN(so.order_date::DATE))`

	var havingParts []string
	var havingArgs []interface{}
	if query.Status != "" {
		havingParts = append(havingParts, statusExpr+" = ?")
		havingArgs = append(havingArgs, query.Status)
	}
	if query.MinAgeDays > 0 {
		havingParts = append(havingParts, ageExpr+" >= ?")
		havingArgs = append(havingArgs, query.MinAgeDays)
	}
	if query.MaxAgeDays > 0 {
		havingParts = append(havingParts, ageExpr+" <= ?")
		havingArgs = append(havingArgs, query.MaxAgeDays)
	}
	havingSQL := ""
	if len(havingParts) > 0 {
		havingSQL = " HAVING " + strings.Join(havingParts, " AND ")
	}

	// count — wrap grouped subquery so HAVING is applied before counting
	countSQL := fmt.Sprintf(`
		SELECT COUNT(*) FROM (
			SELECT c.id
			FROM sale_orders so
			JOIN customers c ON c.id = so.customer_id AND c.deleted_at IS NULL
			WHERE %s%s
			GROUP BY c.id, c.customer_name
			%s
		) sub`, baseWhere, dateFilter, havingSQL)
	countArgs := append(dateArgs, havingArgs...)
	var total int64
	if err := r.db.WithContext(ctx).Raw(countSQL, countArgs...).Scan(&total).Error; err != nil {
		return nil, 0, err
	}

	// data
	dataSQL := fmt.Sprintf(`
		SELECT
			LPAD(CAST(c.id AS VARCHAR), 5, '0') AS customer_code,
			c.customer_name,
			SUM(so.total_amount) AS total_debt,
			SUM(so.balance_due)  AS remaining_balance,
			TO_CHAR(MAX(so.order_date), 'YYYY-MM-DD') AS last_purchase_date,
			(CURRENT_DATE - MIN(so.order_date::DATE)) AS age_days,
			CASE WHEN BOOL_OR(so.due_date IS NOT NULL AND so.due_date < NOW()) THEN 'เกินกำหนด' ELSE 'ทยอยชำระ' END AS status
		FROM sale_orders so
		JOIN customers c ON c.id = so.customer_id AND c.deleted_at IS NULL
		WHERE %s%s
		GROUP BY c.id, c.customer_name
		%s
		ORDER BY
			CASE WHEN BOOL_OR(so.due_date IS NOT NULL AND so.due_date < NOW()) THEN 0 ELSE 1 END ASC,
			SUM(so.balance_due) DESC
		LIMIT ? OFFSET ?`, baseWhere, dateFilter, havingSQL)

	dataArgs := append(append(dateArgs, havingArgs...), pageSize, offset)
	type row struct {
		CustomerCode     string  `gorm:"column:customer_code"`
		CustomerName     string  `gorm:"column:customer_name"`
		TotalDebt        float64 `gorm:"column:total_debt"`
		RemainingBalance float64 `gorm:"column:remaining_balance"`
		LastPurchaseDate string  `gorm:"column:last_purchase_date"`
		AgeDays          int     `gorm:"column:age_days"`
		Status           string  `gorm:"column:status"`
	}
	var rows []row
	if err := r.db.WithContext(ctx).Raw(dataSQL, dataArgs...).Scan(&rows).Error; err != nil {
		return nil, 0, err
	}

	result := make([]dashDto.DebtAgingItemDTO, len(rows))
	for i, rw := range rows {
		result[i] = dashDto.DebtAgingItemDTO{
			CustomerCode:     rw.CustomerCode,
			CustomerName:     rw.CustomerName,
			TotalDebt:        rw.TotalDebt,
			RemainingBalance: rw.RemainingBalance,
			LastPurchaseDate: rw.LastPurchaseDate,
			AgeDays:          rw.AgeDays,
			Status:           rw.Status,
		}
	}
	return result, total, nil
}

// GetTotalDebtors คืนจำนวนลูกหนี้ทั้งหมด (ไม่กรองวัน) สำหรับ KPI card
func (r *dashboardRepository) GetTotalDebtors(ctx context.Context) (int64, error) {
	var count int64
	err := r.db.WithContext(ctx).Model(&dashEntity.SaleOrder{}).
		Where("deleted_at IS NULL AND balance_due > 0 AND customer_id IS NOT NULL AND status NOT IN ?", debtExcludedStatuses).
		Distinct("customer_id").
		Count(&count).Error
	return count, err
}

// GetHistoricalSummaries อ่านจาก daily_summary และคำนวณใหม่เฉพาะวันที่มีการคืนเงินจริง
// เพื่อให้รายการคืนที่เกิดภายหลังยังหักออกจากวันที่ขายได้ทันที
func (r *dashboardRepository) GetHistoricalSummaries(ctx context.Context, start, end time.Time) ([]dashEntity.DailySummary, error) {
	// 1. ดึงเฉพาะแถวที่มีข้อมูลจริงในช่วง [start, end)
	var existing []dashEntity.DailySummary
	if err := r.db.WithContext(ctx).
		Where("summary_date >= ? AND summary_date < ?", start, end).
		Find(&existing).Error; err != nil {
		return nil, err
	}

	// 2. index ด้วย date string เพื่อ lookup O(1)
	byDate := make(map[string]dashEntity.DailySummary, len(existing))
	for _, s := range existing {
		byDate[s.SummaryDate.Format("2006-01-02")] = s
	}

	var refundedSaleDates []time.Time
	if err := r.db.WithContext(ctx).
		Table("sales_returns").
		Joins("JOIN sale_orders ON sale_orders.id = sales_returns.original_order_id AND sale_orders.deleted_at IS NULL").
		Where("sales_returns.refunded_at IS NOT NULL AND sales_returns.deleted_at IS NULL AND sale_orders.order_date >= ? AND sale_orders.order_date < ?", start, end).
		Distinct("sale_orders.order_date").
		Pluck("sale_orders.order_date", &refundedSaleDates).Error; err != nil {
		return nil, err
	}
	affectedDates := make(map[string]struct{}, len(refundedSaleDates))
	for _, saleDate := range refundedSaleDates {
		affectedDates[saleDate.Format("2006-01-02")] = struct{}{}
	}

	// 3. วนทุกวันใน [start, end) จาก end-1 ลงมา เติม zero สำหรับวันที่ไม่มีข้อมูล
	var result []dashEntity.DailySummary
	for d := end.AddDate(0, 0, -1); !d.Before(start); d = d.AddDate(0, 0, -1) {
		key := d.Format("2006-01-02")
		if _, affected := affectedDates[key]; affected {
			fresh, err := r.calculateSummaryForDate(ctx, d)
			if err != nil {
				return nil, err
			}
			result = append(result, *fresh)
			continue
		}
		if s, ok := byDate[key]; ok {
			result = append(result, s)
		} else {
			result = append(result, dashEntity.DailySummary{
				SummaryDate: time.Date(d.Year(), d.Month(), d.Day(), 0, 0, 0, 0, d.Location()),
			})
		}
	}

	return result, nil
}
