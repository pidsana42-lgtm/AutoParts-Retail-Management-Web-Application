package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCheckStockScheduleRoutes(r *gin.Engine, db *gorm.DB) {
	repo       := wmsRepo.NewCheckStockScheduleRepository(db)
	service    := wmsSvc.NewCheckStockScheduleService(repo)
	controller := wmsCtrl.NewCheckStockScheduleController(service)

	wms := r.Group("/api/wms/check-stock-schedules")
	{
		wms.POST("", controller.CreateSchedule)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
		wms.PATCH("/:id/status", controller.UpdateStatus)
		wms.DELETE("/:id", controller.Delete)
	}
}
