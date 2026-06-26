package pre_order

import (
    preOrderCtrl "backend/internal/app/controller/pre_oder"
    preOrderRepo "backend/internal/app/repository/pre_oder"
    preOrderSvc "backend/internal/app/service/pre_oder"

    "backend/internal/app/enum"
    "backend/internal/middleware"

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

    preOrdersGroup := r.Group("/api/pre-orders")
    
    preOrdersGroup.Use(
        middleware.AuthMiddleware(),
        middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
    )
    
    {
        preOrdersGroup.POST("", ctrl.CreatePreOrder)
        preOrdersGroup.POST("/items", ctrl.CreatePreOrderItem)
        preOrdersGroup.GET("/:id", ctrl.GetPreOrderByID)
        preOrdersGroup.GET("", ctrl.ListPreOrders)
        preOrdersGroup.PUT("/:id", ctrl.UpdatePreOrder)
        preOrdersGroup.DELETE("/:id", ctrl.DeletePreOrder)
    }
}