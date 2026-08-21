package wms

import (
	"backend/internal/app/cron"
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"
	wmsSvc  "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCheckStockScheduleRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	repo       := wmsRepo.NewCheckStockScheduleRepository(db)
	service    := wmsSvc.NewCheckStockScheduleService(repo, db, notificationService)
	controller := wmsCtrl.NewCheckStockScheduleController(service)

	// เช็คทุก 1 นาทีว่ามีตารางไหนถึงเวลาเริ่มเช็คแล้วบ้าง จะได้แจ้งเตือนพนักงานทัน
	cron.StartCheckStockDueCron(service)

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
