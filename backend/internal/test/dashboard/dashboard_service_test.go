package dashboard_test

import (
	"context"
	"errors"
	"testing"
	"time"

	dashDTO "backend/internal/app/dto/dashboard"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	dashRepo "backend/internal/app/repository/dashboard"
	dashService "backend/internal/app/service/dashboard"
	"gorm.io/gorm"
)

type fakeDashboardRepository struct {
	summaryFn      func(context.Context, dashDTO.SummaryQuery) ([]entity.DailySummary, int64, error)
	recentFn       func(context.Context, time.Time, time.Time, int, int) ([]entity.SaleOrder, int64, error)
	productsFn     func(context.Context) ([]entity.Product, error)
	lastSoldFn     func(context.Context) (map[uint]time.Time, error)
	historicalFn   func(context.Context, time.Time, time.Time) ([]entity.DailySummary, error)
	liveFn         func(context.Context, time.Time) (*entity.DailySummary, error)
	stockHealthFn  func(context.Context) (*dashDTO.StockHealthDTO, error)
	topSellersFn   func(context.Context, time.Time, time.Time, int) ([]dashDTO.TopSellerDTO, error)
	debtAgingFn    func(context.Context, dashDTO.DebtAgingQuery) ([]dashDTO.DebtAgingItemDTO, int64, error)
	totalDebtorsFn func(context.Context) (int64, error)
}

var _ dashRepo.DashboardRepository = (*fakeDashboardRepository)(nil)

func (f *fakeDashboardRepository) GetSummaryDataByQuery(ctx context.Context, q dashDTO.SummaryQuery) ([]entity.DailySummary, int64, error) {
	if f.summaryFn != nil {
		return f.summaryFn(ctx, q)
	}
	return nil, 0, nil
}
func (f *fakeDashboardRepository) GetRecentSaleOrders(ctx context.Context, start, end time.Time, page, size int) ([]entity.SaleOrder, int64, error) {
	if f.recentFn != nil {
		return f.recentFn(ctx, start, end, page, size)
	}
	return nil, 0, nil
}
func (f *fakeDashboardRepository) GetProductsInStock(ctx context.Context) ([]entity.Product, error) {
	if f.productsFn != nil {
		return f.productsFn(ctx)
	}
	return nil, nil
}
func (f *fakeDashboardRepository) GetLastSoldDates(ctx context.Context) (map[uint]time.Time, error) {
	if f.lastSoldFn != nil {
		return f.lastSoldFn(ctx)
	}
	return map[uint]time.Time{}, nil
}
func (f *fakeDashboardRepository) GetHistoricalSummaries(ctx context.Context, start, end time.Time) ([]entity.DailySummary, error) {
	if f.historicalFn != nil {
		return f.historicalFn(ctx, start, end)
	}
	return nil, nil
}
func (f *fakeDashboardRepository) GetLiveSummaryForDate(ctx context.Context, date time.Time) (*entity.DailySummary, error) {
	if f.liveFn != nil {
		return f.liveFn(ctx, date)
	}
	return &entity.DailySummary{SummaryDate: date}, nil
}
func (f *fakeDashboardRepository) FinalizeDailySummary(context.Context, time.Time) error { return nil }
func (f *fakeDashboardRepository) GetStockHealth(ctx context.Context) (*dashDTO.StockHealthDTO, error) {
	if f.stockHealthFn != nil {
		return f.stockHealthFn(ctx)
	}
	return &dashDTO.StockHealthDTO{}, nil
}
func (f *fakeDashboardRepository) GetTopSellers(ctx context.Context, start, end time.Time, limit int) ([]dashDTO.TopSellerDTO, error) {
	if f.topSellersFn != nil {
		return f.topSellersFn(ctx, start, end, limit)
	}
	return nil, nil
}
func (f *fakeDashboardRepository) GetDebtAging(ctx context.Context, q dashDTO.DebtAgingQuery) ([]dashDTO.DebtAgingItemDTO, int64, error) {
	if f.debtAgingFn != nil {
		return f.debtAgingFn(ctx, q)
	}
	return nil, 0, nil
}
func (f *fakeDashboardRepository) GetTotalDebtors(ctx context.Context) (int64, error) {
	if f.totalDebtorsFn != nil {
		return f.totalDebtorsFn(ctx)
	}
	return 0, nil
}

func TestDashboardServiceRejectsInvalidSummaryBeforeRepository(t *testing.T) {
	called := false
	repo := &fakeDashboardRepository{historicalFn: func(context.Context, time.Time, time.Time) ([]entity.DailySummary, error) {
		called = true
		return nil, nil
	}}
	svc := dashService.NewDashboardService(repo)

	_, err := svc.GetSummaryData(context.Background(), dashDTO.SummaryQuery{
		StartDate: "2026-09-08",
		EndDate:   "2026-09-07",
	})
	if err == nil {
		t.Fatal("expected invalid range error")
	}
	if called {
		t.Fatal("repository must not be called for invalid input")
	}
}

func TestGetRecentSalesNormalizesPaginationAndMapsFields(t *testing.T) {
	method := &entity.PaymentMethod{MethodName: "เงินสด"}
	var capturedPage, capturedSize int
	repo := &fakeDashboardRepository{recentFn: func(_ context.Context, start, end time.Time, page, size int) ([]entity.SaleOrder, int64, error) {
		capturedPage, capturedSize = page, size
		if end.Sub(start) != 24*time.Hour {
			t.Errorf("expected one-day range, got %s", end.Sub(start))
		}
		return []entity.SaleOrder{{
			Model:         gorm.Model{ID: 7, CreatedAt: start.Add(time.Hour)},
			OrderNumber:   "SO-007",
			Status:        enum.OrderCompleted,
			TotalAmount:   1250,
			PaymentMethod: method,
		}}, 1, nil
	}}
	svc := dashService.NewDashboardService(repo)

	got, err := svc.GetRecentSales(context.Background(), dashDTO.SummaryQuery{SummaryDate: "2026-09-07"}, 0, 500)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capturedPage != 1 || capturedSize != 100 {
		t.Fatalf("pagination = (%d,%d), want (1,100)", capturedPage, capturedSize)
	}
	if len(got.Data) != 1 || got.Data[0].OrderNumber != "SO-007" || got.Data[0].PaymentMethod != "เงินสด" {
		t.Fatalf("unexpected mapping: %+v", got.Data)
	}
	if got.Data[0].OrderStatus != "สำเร็จ" {
		t.Errorf("unexpected status label: %q", got.Data[0].OrderStatus)
	}
}

func TestGetAgingStockFiltersSortsAndCalculatesValue(t *testing.T) {
	now := time.Now()
	unit := &entity.Unit{Unit_Name: "ชิ้น"}
	repo := &fakeDashboardRepository{
		productsFn: func(context.Context) ([]entity.Product, error) {
			return []entity.Product{
				{Model: gorm.Model{ID: 1}, Product_Code: "OLD", Product_Name: "Old", Quantity: 3, Cost_price: 20, Import_DateTime: now.AddDate(0, 0, -200), Unit: unit},
				{Model: gorm.Model{ID: 2}, Product_Code: "NEW", Product_Name: "New", Quantity: 2, Cost_price: 10, Import_DateTime: now.AddDate(0, 0, -10)},
				{Model: gorm.Model{ID: 3}, Product_Code: "SOLD", Product_Name: "Sold", Quantity: 1, Cost_price: 50, Import_DateTime: now.AddDate(-1, 0, 0)},
			}, nil
		},
		lastSoldFn: func(context.Context) (map[uint]time.Time, error) {
			return map[uint]time.Time{3: now.AddDate(0, 0, -100)}, nil
		},
	}

	got, err := dashService.NewDashboardService(repo).GetAgingStock(context.Background(), 90)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 aging products, got %d", len(got))
	}
	if got[0].ProductCode != "OLD" || got[0].Rank != 1 || got[0].SunkValue != 60 || got[0].Unit != "ชิ้น" {
		t.Errorf("unexpected first row: %+v", got[0])
	}
	if got[1].ProductCode != "SOLD" || got[1].LastSoldDate == nil {
		t.Errorf("unexpected sold row: %+v", got[1])
	}
}

func TestGetIncomeSummaryAggregatesBreakdowns(t *testing.T) {
	date := time.Date(2026, 9, 1, 0, 0, 0, 0, time.Local)
	repo := &fakeDashboardRepository{historicalFn: func(context.Context, time.Time, time.Time) ([]entity.DailySummary, error) {
		return []entity.DailySummary{
			{SummaryDate: date, WalkinCustomerAmount: 100, GarageCustomerAmount: 50, CorporateCustomerAmount: 25, CashAmount: 80, TransferAmount: 70, CreditAmount: 25},
			{SummaryDate: date.AddDate(0, 0, 1), WalkinCustomerAmount: 10, GarageCustomerAmount: 5, CorporateCustomerAmount: 2, CashAmount: 8, TransferAmount: 7, CreditAmount: 2},
		}, nil
	}}

	got, err := dashService.NewDashboardService(repo).GetIncomeSummary(context.Background(), dashDTO.SummaryQuery{
		StartDate: "2026-09-01", EndDate: "2026-09-02",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.CustomerData[0].Value != 110 || got.CustomerData[1].Value != 55 || got.CustomerData[2].Value != 27 {
		t.Errorf("unexpected customer totals: %+v", got.CustomerData)
	}
	if got.PaymentData[0].Value != 88 || got.PaymentData[1].Value != 77 || got.PaymentData[2].Value != 27 {
		t.Errorf("unexpected payment totals: %+v", got.PaymentData)
	}
}

func TestGetDebtAgingPropagatesRepositoryErrors(t *testing.T) {
	want := errors.New("database unavailable")
	repo := &fakeDashboardRepository{debtAgingFn: func(context.Context, dashDTO.DebtAgingQuery) ([]dashDTO.DebtAgingItemDTO, int64, error) {
		return nil, 0, want
	}}

	_, err := dashService.NewDashboardService(repo).GetDebtAging(context.Background(), dashDTO.DebtAgingQuery{})
	if !errors.Is(err, want) {
		t.Fatalf("expected %v, got %v", want, err)
	}
}
