package dashboard

import (
	"context"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func newDashboardRepositoryTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	for _, statement := range []string{
		`CREATE TABLE payment_repayments (
			id INTEGER PRIMARY KEY,
			amount_paid NUMERIC NOT NULL,
			paid_at DATETIME,
			status TEXT NOT NULL,
			deleted_at DATETIME
		)`,
		`CREATE TABLE daily_summary (
			id INTEGER PRIMARY KEY,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			summary_date DATETIME,
			collected_debt_amount NUMERIC NOT NULL DEFAULT 0
		)`,
		`CREATE TABLE sale_orders (
			id INTEGER PRIMARY KEY,
			order_date DATETIME,
			deleted_at DATETIME
		)`,
		`CREATE TABLE sales_returns (
			id INTEGER PRIMARY KEY,
			original_order_id INTEGER,
			refunded_at DATETIME,
			deleted_at DATETIME
		)`,
	} {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf("create test table: %v", err)
		}
	}
	return db
}

func TestGetCollectedDebtByDateCountsOnlyCompletedRepayments(t *testing.T) {
	db := newDashboardRepositoryTestDB(t)
	repo := &dashboardRepository{db: db}
	location := time.FixedZone("Asia/Bangkok", 7*60*60)
	start := time.Date(2026, 9, 18, 0, 0, 0, 0, location)
	end := start.AddDate(0, 0, 2)

	rows := []struct {
		amount    float64
		paidAt    time.Time
		status    string
		deletedAt any
	}{
		{100, start.Add(time.Hour), "completed", nil},
		{25, start.Add(2 * time.Hour), "completed", nil},
		{300, start.Add(3 * time.Hour), "cancelled", nil},
		{400, start.Add(4 * time.Hour), "pending_cancel", nil},
		{500, start.Add(5 * time.Hour), "completed", start.Add(6 * time.Hour)},
		{50, start.AddDate(0, 0, 1).Add(time.Hour), "completed", nil},
	}
	for _, row := range rows {
		if err := db.Exec(
			"INSERT INTO payment_repayments (amount_paid, paid_at, status, deleted_at) VALUES (?, ?, ?, ?)",
			row.amount, row.paidAt, row.status, row.deletedAt,
		).Error; err != nil {
			t.Fatalf("insert repayment: %v", err)
		}
	}

	amounts, err := repo.getCollectedDebtByDate(context.Background(), start, end)
	if err != nil {
		t.Fatalf("get collected debt: %v", err)
	}
	if got := amounts["2026-09-18"]; got != 125 {
		t.Fatalf("first day collected debt = %.2f, want 125.00", got)
	}
	if got := amounts["2026-09-19"]; got != 50 {
		t.Fatalf("second day collected debt = %.2f, want 50.00", got)
	}
}

func TestGetHistoricalSummariesReplacesStaleCollectedDebt(t *testing.T) {
	db := newDashboardRepositoryTestDB(t)
	repo := &dashboardRepository{db: db}
	location := time.FixedZone("Asia/Bangkok", 7*60*60)
	start := time.Date(2026, 9, 18, 0, 0, 0, 0, location)
	end := start.AddDate(0, 0, 1)

	if err := db.Exec(
		"INSERT INTO daily_summary (summary_date, collected_debt_amount) VALUES (?, ?)",
		start, 999,
	).Error; err != nil {
		t.Fatalf("insert stale summary: %v", err)
	}
	if err := db.Exec(
		"INSERT INTO payment_repayments (amount_paid, paid_at, status) VALUES (?, ?, ?)",
		125, start.Add(time.Hour), completedRepaymentStatus,
	).Error; err != nil {
		t.Fatalf("insert repayment: %v", err)
	}

	summaries, err := repo.GetHistoricalSummaries(context.Background(), start, end)
	if err != nil {
		t.Fatalf("get historical summaries: %v", err)
	}
	if len(summaries) != 1 {
		t.Fatalf("summary count = %d, want 1", len(summaries))
	}
	if got := summaries[0].CollectedDebtAmount; got != 125 {
		t.Fatalf("collected debt = %.2f, want refreshed value 125.00", got)
	}
}

func TestGetStockHealthUsesQuantityComparedWithMinimum(t *testing.T) {
	db := newDashboardRepositoryTestDB(t)
	err := db.Exec(`CREATE TABLE products (
		id INTEGER PRIMARY KEY,
		quantity INTEGER NOT NULL,
		limit_quantity INTEGER NOT NULL,
		is_active BOOLEAN NOT NULL,
		deleted_at DATETIME
	)`).Error
	if err != nil {
		t.Fatalf(`create products table: %v`, err)
	}
	err = db.Exec(`INSERT INTO products (quantity, limit_quantity, is_active) VALUES
		(1, 5, true), (0, 5, true), (1, 5, true), (1, 5, true),
		(1, 5, true), (1, 5, true), (3, 5, true)`).Error
	if err != nil {
		t.Fatalf(`insert products: %v`, err)
	}

	result, err := (&dashboardRepository{db: db}).GetStockHealth(context.Background())
	if err != nil {
		t.Fatalf(`get stock health: %v`, err)
	}
	if result.TotalProducts != 7 {
		t.Fatalf(`total products = %d, want 7`, result.TotalProducts)
	}
	if result.HealthyCount != 0 || result.LowStockCount != 6 || result.OutOfStockCount != 1 {
		t.Fatalf(`stock buckets = %d/%d/%d, want 0/6/1`,
			result.HealthyCount, result.LowStockCount, result.OutOfStockCount)
	}
	if result.HealthPercent != 23 {
		t.Fatalf(`health percent = %.0f, want 23`, result.HealthPercent)
	}

	if err := db.Exec(`UPDATE products SET quantity = 100`).Error; err != nil {
		t.Fatalf(`update products: %v`, err)
	}
	result, err = (&dashboardRepository{db: db}).GetStockHealth(context.Background())
	if err != nil {
		t.Fatalf(`get capped stock health: %v`, err)
	}
	if result.HealthPercent != 100 {
		t.Fatalf(`capped health percent = %.0f, want 100`, result.HealthPercent)
	}
}

func TestGetProductsInStockLoadsUnitWithJoin(t *testing.T) {
	db := newDashboardRepositoryTestDB(t)
	for _, statement := range []string{
		`CREATE TABLE units (
			id INTEGER PRIMARY KEY,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			unit_name TEXT
		)`,
		`CREATE TABLE products (
			id INTEGER PRIMARY KEY,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			product_code TEXT,
			part_number TEXT,
			product_name TEXT,
			quantity INTEGER NOT NULL,
			limit_quantity INTEGER,
			sale_price NUMERIC,
			cost_price NUMERIC,
			is_active BOOLEAN,
			import_date_time DATETIME,
			note TEXT,
			unit_id INTEGER,
			category_id INTEGER,
			sub_category_id INTEGER,
			sub_sub_category_id INTEGER,
			grade_id INTEGER,
			shelf_id INTEGER,
			shelf_level_id INTEGER,
			max_discount_rate NUMERIC
		)`,
		`INSERT INTO units (id, unit_name) VALUES (1, 'ชิ้น')`,
		`INSERT INTO products (id, quantity, unit_id) VALUES (1, 3, 1), (2, 0, 1)`,
	} {
		if err := db.Exec(statement).Error; err != nil {
			t.Fatalf(`prepare joined product data: %v`, err)
		}
	}

	products, err := (&dashboardRepository{db: db}).GetProductsInStock(context.Background())
	if err != nil {
		t.Fatalf(`get products in stock: %v`, err)
	}
	if len(products) != 1 {
		t.Fatalf(`products count = %d, want 1`, len(products))
	}
	if products[0].Unit == nil || products[0].Unit.Unit_Name != `ชิ้น` {
		t.Fatalf(`joined unit was not loaded`)
	}
}
