package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCheckStockRoutes(r *gin.Engine, db *gorm.DB) {
	repo         := wmsRepo.NewCheckStockRepository(db)
	scheduleRepo := wmsRepo.NewCheckStockScheduleRepository(db)
	service      := wmsSvc.NewCheckStockService(repo, scheduleRepo)
	controller   := wmsCtrl.NewCheckStockController(service)

	wms := r.Group("/api/wms/check-stocks")
	{
		wms.POST("", controller.CreateCheckStock)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
	}
}
