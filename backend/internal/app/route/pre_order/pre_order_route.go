package pre_order

import (
	preOrderController "backend/internal/app/controller/pre_oder"
	"github.com/gin-gonic/gin"
)

func SetupPreOrderRoutes(rg *gin.RouterGroup) {
	preOrders := rg.Group("/pre-orders")
	{
		preOrders.POST("", preOrderController.CreatePreOrder)
		preOrders.POST("/items", preOrderController.CreatePreOrderItem)
	}
}
