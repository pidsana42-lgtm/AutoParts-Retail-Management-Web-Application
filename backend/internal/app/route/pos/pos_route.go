package pos

import (
	posCtrl "backend/internal/app/controller/pos"
	"backend/internal/app/enum"
	customerRepo "backend/internal/app/repository/customer"
	posRepo "backend/internal/app/repository/pos"
	posSvc "backend/internal/app/service/pos"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPOSRoutes(r *gin.Engine, db *gorm.DB) {
	posProductRepo := posRepo.NewPOSProductRepository(db)
	posProductSvc := posSvc.NewPOSProductService(posProductRepo)
	posProductCtrl := posCtrl.NewPOSProductController(posProductSvc)

	customerRepository := customerRepo.NewCustomerRepository(db)
	saleRepo := posRepo.NewSaleRepository(db)
	saleSvc := posSvc.NewSaleService(saleRepo, customerRepository, posProductRepo)
	saleCtrl := posCtrl.NewSaleController(saleSvc)

	posGroup := r.Group("/api/pos")
	posGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		posGroup.GET("/products", posProductCtrl.SearchProducts)
		posGroup.POST("/orders", saleCtrl.CreateOrderHandler)
		posGroup.PUT("/orders/:id", saleCtrl.UpdateOrderHandler)
		posGroup.GET("/customer-types", saleCtrl.GetCustomerTypes)
		posGroup.GET("/customer-search", saleCtrl.SearchCustomerDiscount)
		posGroup.GET("/payment-methods", saleCtrl.GetPaymentMethods)
	}
}
