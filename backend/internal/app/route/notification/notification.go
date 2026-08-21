package notification

import (
	ctrlNotification "backend/internal/app/controller/notification"
	repoNotification "backend/internal/app/repository/notification"
	svcNotification "backend/internal/app/service/notification"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupNotificationRoutes ยังคืน service กลับมาด้วย เพื่อให้ domain อื่น (เช่น wms check-stock) เอาไปใช้ยิงแจ้งเตือนแบบเจาะจงได้
func SetupNotificationRoutes(r *gin.Engine, db *gorm.DB) svcNotification.NotificationService {
	repo := repoNotification.NewNotificationRepository(db)
	service := svcNotification.NewNotificationService(repo)
	controller := ctrlNotification.NewNotificationController(service)

	notif := r.Group("/api/notifications")
	{
		notif.GET("", controller.List)
		notif.PATCH("/:id/read", controller.MarkRead)
		notif.PATCH("/read-all", controller.MarkAllRead)
	}

	return service
}
