package dashboard_test

import (
	"context"
	"encoding/csv"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	dashboardController "backend/internal/app/controller/dashboard"
	dashDTO "backend/internal/app/dto/dashboard"
	"backend/internal/app/enum"
	dashService "backend/internal/app/service/dashboard"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
)

type fakeDashboardService struct {
	summaryCalls int
	recentCalls  int
	agingCalls   int
	agingQueries []dashDTO.DebtAgingQuery
	agingData    []dashDTO.DebtAgingItemDTO
	summaryErr   error
	summaryData  []dashDTO.DisplayDashboardDTO
}

var _ dashService.DashboardService = (*fakeDashboardService)(nil)

func (f *fakeDashboardService) GetSummaryData(context.Context, dashDTO.SummaryQuery) (*dashDTO.SummaryResponse, error) {
	f.summaryCalls++
	if f.summaryErr != nil {
		return nil, f.summaryErr
	}
	return &dashDTO.SummaryResponse{SummaryData: f.summaryData, Total: int64(len(f.summaryData))}, nil
}
func (f *fakeDashboardService) GetRecentSales(context.Context, dashDTO.SummaryQuery, int, int) (*dashDTO.RecentSalesResponse, error) {
	f.recentCalls++
	return &dashDTO.RecentSalesResponse{}, nil
}
func (f *fakeDashboardService) GetAgingStock(context.Context, int) ([]dashDTO.AgingStockDTO, error) {
	f.agingCalls++
	return []dashDTO.AgingStockDTO{}, nil
}
func (*fakeDashboardService) GetStockHealth(context.Context) (*dashDTO.StockHealthDTO, error) {
	return &dashDTO.StockHealthDTO{}, nil
}
func (*fakeDashboardService) GetIncomeSummary(context.Context, dashDTO.SummaryQuery) (*dashDTO.RevenueBreakdownResponse, error) {
	return &dashDTO.RevenueBreakdownResponse{}, nil
}
func (*fakeDashboardService) GetTopSellers(context.Context, dashDTO.SummaryQuery, int) ([]dashDTO.TopSellerDTO, error) {
	return []dashDTO.TopSellerDTO{}, nil
}
func (f *fakeDashboardService) GetDebtAging(_ context.Context, query dashDTO.DebtAgingQuery) (*dashDTO.DebtAgingResponse, error) {
	f.agingQueries = append(f.agingQueries, query)
	return &dashDTO.DebtAgingResponse{Data: f.agingData, Total: int64(len(f.agingData))}, nil
}

func performControllerRequest(method, target string, handler gin.HandlerFunc) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(method, target, nil)
	handler(ctx)
	return recorder
}

func TestDashboardControllerValidation(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name       string
		target     string
		handler    func(*dashboardController.DashboardController) gin.HandlerFunc
		assertCall func(*fakeDashboardService) bool
	}{
		{
			name:       "summary reversed dates",
			target:     "/dashboard/summary?start_date=2026-09-08&end_date=2026-09-07",
			handler:    func(c *dashboardController.DashboardController) gin.HandlerFunc { return c.GetSummaryData },
			assertCall: func(f *fakeDashboardService) bool { return f.summaryCalls > 0 },
		},
		{
			name:       "recent sales zero page",
			target:     "/dashboard/recent-sales?page=0",
			handler:    func(c *dashboardController.DashboardController) gin.HandlerFunc { return c.GetRecentSales },
			assertCall: func(f *fakeDashboardService) bool { return f.recentCalls > 0 },
		},
		{
			name:       "recent sales oversized page",
			target:     "/dashboard/recent-sales?page_size=101",
			handler:    func(c *dashboardController.DashboardController) gin.HandlerFunc { return c.GetRecentSales },
			assertCall: func(f *fakeDashboardService) bool { return f.recentCalls > 0 },
		},
		{
			name:       "aging stock invalid days",
			target:     "/dashboard/aging-stock?days=abc",
			handler:    func(c *dashboardController.DashboardController) gin.HandlerFunc { return c.GetAgingStock },
			assertCall: func(f *fakeDashboardService) bool { return f.agingCalls > 0 },
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fake := &fakeDashboardService{}
			controller := dashboardController.NewDashboardController(fake)
			response := performControllerRequest(http.MethodGet, tt.target, tt.handler(controller))
			if response.Code != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400; body=%s", response.Code, response.Body.String())
			}
			if tt.assertCall(fake) {
				t.Fatal("service must not be called for invalid input")
			}
		})
	}
}

func TestDashboardControllerSuccessAndServiceError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("valid summary", func(t *testing.T) {
		fake := &fakeDashboardService{}
		controller := dashboardController.NewDashboardController(fake)
		response := performControllerRequest(http.MethodGet, "/dashboard/summary?monthly_summary=1", controller.GetSummaryData)
		if response.Code != http.StatusOK || fake.summaryCalls != 1 {
			t.Fatalf("status=%d calls=%d body=%s", response.Code, fake.summaryCalls, response.Body.String())
		}
	})

	t.Run("service failure", func(t *testing.T) {
		fake := &fakeDashboardService{summaryErr: errors.New("database unavailable")}
		controller := dashboardController.NewDashboardController(fake)
		response := performControllerRequest(http.MethodGet, "/dashboard/summary", controller.GetSummaryData)
		if response.Code != http.StatusInternalServerError {
			t.Fatalf("status=%d, want 500", response.Code)
		}
	})
}

func TestExportDebtAgingExcelAppliesFiltersAndFormatsThaiDate(t *testing.T) {
	gin.SetMode(gin.TestMode)
	fake := &fakeDashboardService{agingData: []dashDTO.DebtAgingItemDTO{{
		CustomerCode:     "00001",
		CustomerName:     "ลูกค้าทดสอบ",
		TotalDebt:        1500,
		RemainingBalance: 750,
		LastPurchaseDate: "2026-09-18",
		AgeDays:          10,
		Status:           "ทยอยชำระ",
	}}}
	controller := dashboardController.NewDashboardController(fake)
	response := performControllerRequest(
		http.MethodGet,
		"/dashboard/debt-aging/export/excel?start_date=2026-09-18&end_date=2026-09-18&status=ทยอยชำระ&min_age_days=5&max_age_days=30",
		controller.ExportDebtAgingExcel,
	)

	if response.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", response.Code, response.Body.String())
	}
	if len(fake.agingQueries) != 1 {
		t.Fatalf("aging calls=%d, want 1", len(fake.agingQueries))
	}
	query := fake.agingQueries[0]
	if query.StartDate != "2026-09-18" || query.EndDate != "2026-09-18" || query.Status != "ทยอยชำระ" || query.MinAgeDays != 5 || query.MaxAgeDays != 30 {
		t.Fatalf("export filters were not forwarded: %+v", query)
	}

	body := strings.TrimPrefix(response.Body.String(), "\xEF\xBB\xBF")
	records, err := csv.NewReader(strings.NewReader(body)).ReadAll()
	if err != nil {
		t.Fatalf("parse csv: %v", err)
	}
	if len(records) != 2 || len(records[0]) != 7 {
		t.Fatalf("unexpected csv shape: %+v", records)
	}
	if records[1][3] != "750.00" || records[1][4] != "18-09-2569" {
		t.Fatalf("unexpected exported values: %+v", records[1])
	}
}

func TestDashboardSummaryRedactsManagementMetricsForEmployeeRoles(t *testing.T) {
	gin.SetMode(gin.TestMode)

	for _, tc := range []struct {
		role     string
		redacted bool
	}{
		{"Owner", false},
		{"Manager", false},
		{"Employee", true},
	} {
		t.Run(tc.role, func(t *testing.T) {
			fake := &fakeDashboardService{summaryData: []dashDTO.DisplayDashboardDTO{{
				TotalRevenue:  150,
				TotalCost:     100,
				GrossProfit:   50,
				MarginPercent: 33.33,
			}}}
			controller := dashboardController.NewDashboardController(fake)
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/dashboard/summary", nil)
			ctx.Set("role", tc.role)

			controller.GetSummaryData(ctx)

			if recorder.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", recorder.Code, recorder.Body.String())
			}
			var response dashDTO.SummaryResponse
			if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			row := response.SummaryData[0]
			if row.TotalRevenue != 150 {
				t.Fatalf("operational revenue must remain visible: %+v", row)
			}
			if tc.redacted {
				if row.TotalCost != 0 || row.GrossProfit != 0 || row.MarginPercent != 0 {
					t.Fatalf("management metrics leaked to %s: %+v", tc.role, row)
				}
			} else if row.TotalCost != 100 || row.GrossProfit != 50 || row.MarginPercent != 33.33 {
				t.Fatalf("management metrics were removed from %s: %+v", tc.role, row)
			}
		})
	}
}

func TestDashboardRoleMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	allowed := []string{string(enum.RoleManager), string(enum.RoleEmployee)}

	for _, test := range []struct {
		name       string
		role       string
		setRole    bool
		wantStatus int
	}{
		{"manager allowed", string(enum.RoleManager), true, http.StatusOK},
		{"admin allowed", string(enum.RoleAdmin), true, http.StatusOK},
		{"employee allowed", string(enum.RoleEmployee), true, http.StatusOK},
		{"unknown role forbidden", "Guest", true, http.StatusForbidden},
		{"missing role unauthorized", "", false, http.StatusUnauthorized},
	} {
		t.Run(test.name, func(t *testing.T) {
			recorder := httptest.NewRecorder()
			ctx, _ := gin.CreateTestContext(recorder)
			ctx.Request = httptest.NewRequest(http.MethodGet, "/dashboard", nil)
			if test.setRole {
				ctx.Set("role", test.role)
			}
			middleware.RequireRoles(allowed...)(ctx)
			if !ctx.IsAborted() {
				ctx.Status(http.StatusOK)
			}
			if recorder.Code != test.wantStatus {
				t.Fatalf("status=%d, want %d", recorder.Code, test.wantStatus)
			}
		})
	}
}

func TestDashboardAuthMiddlewareRejectsMissingToken(t *testing.T) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodGet, "/dashboard", nil)

	middleware.AuthMiddleware()(ctx)

	if recorder.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d, want 401", recorder.Code)
	}
}
