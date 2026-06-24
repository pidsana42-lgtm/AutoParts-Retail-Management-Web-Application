package pre_order

import (
	preOrderCtrl "backend/internal/app/controller/pre_oder"
	preOrderRepo "backend/internal/app/repository/pre_oder"
	preOrderSvc "backend/internal/app/service/pre_oder"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPreOrderRoutes(r *gin.Engine, db *gorm.DB) {
	// 1. Repository
	repo := preOrderRepo.NewPreOrderRepository(db)

	// 2. Service
	svc := preOrderSvc.NewPreOrderService(repo)

	// 3. Controller
	ctrl := preOrderCtrl.NewPreOrderController(svc)

	api := r.Group("/api")
	preOrders := api.Group("/pre-orders")
	{
		preOrders.POST("", ctrl.CreatePreOrder)
		preOrders.POST("/items", ctrl.CreatePreOrderItem)
		preOrders.GET("/:id", ctrl.GetPreOrderByID)
		preOrders.GET("", ctrl.ListPreOrders)
		preOrders.PUT("/:id", ctrl.UpdatePreOrder)
		preOrders.DELETE("/:id", ctrl.DeletePreOrder)
	}
}
