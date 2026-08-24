package dashboard

import (
	dashboardCtrl "backend/internal/app/controller/dashboard"
	dashboardRepo "backend/internal/app/repository/dashboard"
	dashboardSvc  "backend/internal/app/service/dashboard"
	dashboardCron "backend/internal/app/cron"

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupDashboardRoutes(r *gin.Engine, db *gorm.DB) {
	repo := dashboardRepo.NewDashboardRepository(db)
	svc  := dashboardSvc.NewDashboardService(repo)
	ctrl := dashboardCtrl.NewDashboardController(svc)

	dashboardCron.StartDashboardSummaryCron(repo)

	dashboardGroup := r.Group("/api/dashboard")
	dashboardGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin), string(enum.RoleEmployee)),
	)
	{
		dashboardGroup.GET("/summary", ctrl.GetSummaryData)
		dashboardGroup.GET("/recent-sales", ctrl.GetRecentSales)
		dashboardGroup.GET("/aging-stock", ctrl.GetAgingStock)
		dashboardGroup.GET("/stock-health", ctrl.GetStockHealth)
		dashboardGroup.GET("/income-summary", ctrl.GetIncomeSummary)
		dashboardGroup.GET("/top-sellers", ctrl.GetTopSellers)
		dashboardGroup.GET("/debt-aging", ctrl.GetDebtAging)
		dashboardGroup.GET("/debt-aging/export/excel", ctrl.ExportDebtAgingExcel)
		dashboardGroup.GET("/debt-aging/export/pdf", ctrl.ExportDebtAgingPdf)
	}
}
