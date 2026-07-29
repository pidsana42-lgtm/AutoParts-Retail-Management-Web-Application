package pos

import (
	salesHistoryCtrl "backend/internal/app/controller/pos"
	"backend/internal/app/enum"
	salesHistoryRepo "backend/internal/app/repository/pos"
	salesHistorySvc "backend/internal/app/service/pos"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupSalesHistoryRoutes(r *gin.Engine, db *gorm.DB) {
	repo := salesHistoryRepo.NewSalesHistoryRepository(db)
	svc := salesHistorySvc.NewSalesHistoryService(repo)
	ctrl := salesHistoryCtrl.NewSalesHistoryController(svc)

	salesGroup := r.Group("/api/pos")
	salesGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		salesGroup.GET("/sales/history", ctrl.GetSalesHistory)
	}
}