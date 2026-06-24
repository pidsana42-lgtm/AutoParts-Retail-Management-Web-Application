package route

import (
	"backend/internal/app/controller/claim"
	preOrderController "backend/internal/app/controller/pre_oder"
	"backend/internal/app/route/import_bill"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		// Import Bill & OCR Routes
		import_bill.RegisterBillRoutes(api)

		// Pre Order Routes
		preOrders := api.Group("/pre-orders")
		{
			preOrders.POST("", preOrderController.CreatePreOrder)
			preOrders.POST("/items", preOrderController.CreatePreOrderItem)
		}

		// Claim & Sales Return Routes
		claims := api.Group("/claims")
		{
			claims.POST("/sales-returns", claim.CreateSalesReturn)
			claims.POST("/sales-returns/items", claim.CreateSalesReturnItem)
			claims.POST("/supplier-claims", claim.CreateSupplierClaim)
			claims.POST("/supplier-claims/items", claim.CreateSupplierClaimItem)
		}
	}
}
