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
	service    := wmsSvc.NewCheckStockScheduleService(repo, db)
	controller := wmsCtrl.NewCheckStockScheduleController(service)

	wms := r.Group("/api/wms/check-stock-schedules")
	{
		wms.POST("", controller.CreateSchedule)
		wms.GET("", controller.List)
		wms.GET("/employees", controller.ListEmployees)
		wms.GET("/options/zone-tree", controller.GetZoneTree)
		wms.GET("/options/category-tree", controller.GetCategoryTree)
		wms.GET("/:id", controller.GetByID)
		wms.PUT("/:id", controller.UpdateSchedule)
		wms.PATCH("/:id/status", controller.UpdateStatus)
		wms.POST("/:id/approve", controller.Approve)
		wms.POST("/:id/reject", controller.Reject)
		wms.DELETE("/:id", controller.Delete)
	}
}
