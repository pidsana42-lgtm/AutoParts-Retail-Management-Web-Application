package pre_order

import (
	preOrderCtrl "backend/internal/app/controller/pre_oder"
	preOrderRepo "backend/internal/app/repository/pre_oder"
	svcNotification "backend/internal/app/service/notification"
	preOrderSvc "backend/internal/app/service/pre_oder"
	"backend/internal/app/enum"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPreOrderRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	// 1. Repository
	repo := preOrderRepo.NewPreOrderRepository(db)

	// 2. Service
	svc := preOrderSvc.NewPreOrderService(repo)

	// 3. Controller
	ctrl := preOrderCtrl.NewPreOrderController(svc, notificationService)

	preOrderGroup := r.Group("/api/wms/pre-orders")
	preOrderGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		preOrderGroup.POST("", ctrl.CreatePreOrder)
		preOrderGroup.GET("", ctrl.ListPreOrders)
		preOrderGroup.GET("/:id", ctrl.GetPreOrderByID)
		preOrderGroup.PUT("/:id", ctrl.UpdatePreOrder)
		preOrderGroup.DELETE("/:id", ctrl.DeletePreOrder)
		// PO
		preOrderGroup.GET("/for-po-selection", ctrl.ListPreOrdersForPOSelection)
	}
}