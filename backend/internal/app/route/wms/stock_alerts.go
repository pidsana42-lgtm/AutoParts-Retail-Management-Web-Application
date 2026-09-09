package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	"backend/internal/app/cron"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"
	wmsSvc "backend/internal/app/service/wms"
	"backend/internal/middleware"
	"log"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupStockAlertRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	repo := wmsRepo.NewStockAlertRepository(db)
	service := wmsSvc.NewStockAlertService(repo)
	// Register before other routes so successful stock-changing requests are
	// checked after their transactions finish. Cron remains a fallback for writes
	// made outside the Go API (e.g. an external import worker).
	r.Use(StockAlertCheckMiddleware(service, notificationService))

	// ตรวจสอบสินค้าใกล้หมดทุก 5 นาที สร้าง StockAlert + แจ้งเตือนที่กระดิ่งให้เจ้าของร้านอัตโนมัติ
	cron.StartLowStockCron(service, notificationService)
	RegisterStockAlertRoutes(r, service, notificationService)
}

// RegisterStockAlertRoutes also permits isolated HTTP tests without starting cron.
func RegisterStockAlertRoutes(r *gin.Engine, service wmsSvc.StockAlertService, notificationService svcNotification.NotificationService) {
	controller := wmsCtrl.NewStockAlertController(service)
	wms := r.Group("/api/wms/stock-alerts")
	{
		// All authenticated users need login reminders. This does not grant PO approval permissions.
		wms.POST("/refresh", middleware.AuthMiddleware(), func(c *gin.Context) {
			if err := cron.CheckLowStockAndNotify(service, notificationService); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot refresh stock alerts"})
				return
			}
			alerts, err := service.List("false")
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "cannot list stock alerts"})
				return
			}
			c.JSON(http.StatusOK, alerts)
		})
		wms.POST("", controller.Create)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
		wms.PATCH("/:id/resolve", controller.UpdateResolved)
	}
}

func StockAlertCheckMiddleware(service wmsSvc.StockAlertService, notifications svcNotification.NotificationService) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()
		if c.Writer.Status() < 200 || c.Writer.Status() >= 300 || c.IsAborted() {
			return
		}
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch, http.MethodDelete:
		default:
			return
		}
		for _, prefix := range []string{"/api/notifications", "/api/auth", "/api/wms/stock-alerts"} {
			if strings.HasPrefix(c.Request.URL.Path, prefix) {
				return
			}
		}
		if err := cron.CheckLowStockAndNotify(service, notifications); err != nil {
			// The business transaction already succeeded; don't overwrite its response.
			log.Printf("[stock-alert] post-request check failed: %v", err)
		}
	}
}
