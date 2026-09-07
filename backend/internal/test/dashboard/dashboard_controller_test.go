package dashboard_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
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
	summaryErr   error
}

var _ dashService.DashboardService = (*fakeDashboardService)(nil)

func (f *fakeDashboardService) GetSummaryData(context.Context, dashDTO.SummaryQuery) (*dashDTO.SummaryResponse, error) {
	f.summaryCalls++
	if f.summaryErr != nil {
		return nil, f.summaryErr
	}
	return &dashDTO.SummaryResponse{SummaryData: []dashDTO.DisplayDashboardDTO{}, Total: 0}, nil
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
func (*fakeDashboardService) GetDebtAging(context.Context, dashDTO.DebtAgingQuery) (*dashDTO.DebtAgingResponse, error) {
	return &dashDTO.DebtAgingResponse{}, nil
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

func TestDashboardRoleMiddleware(t *testing.T) {
	gin.SetMode(gin.TestMode)
	allowed := []string{string(enum.RoleAdmin), string(enum.RoleEmployee)}

	for _, test := range []struct {
		name       string
		role       string
		setRole    bool
		wantStatus int
	}{
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
