package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	"backend/internal/app/cron"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupStockAlertRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	repo := wmsRepo.NewStockAlertRepository(db)
	service := wmsSvc.NewStockAlertService(repo)
	controller := wmsCtrl.NewStockAlertController(service)

	// ตรวจสอบสินค้าใกล้หมดทุก 5 นาที สร้าง StockAlert + แจ้งเตือนที่กระดิ่งให้เจ้าของร้านอัตโนมัติ
	cron.StartLowStockCron(service, notificationService)

	wms := r.Group("/api/wms/stock-alerts")
	{
		wms.POST("", controller.Create)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
		wms.PATCH("/:id/resolve", controller.UpdateResolved)
	}
}
