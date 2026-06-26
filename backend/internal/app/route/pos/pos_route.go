package pos

import (
    posCtrl "backend/internal/app/controller/pos"
	"backend/internal/app/enum"
    "backend/internal/middleware" 
    posRepo "backend/internal/app/repository/pos"
    posSvc "backend/internal/app/service/pos"
	customerRepo "backend/internal/app/repository/customer"
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
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	) 
    {
        posGroup.GET("/products", posProductCtrl.SearchProducts)
    	posGroup.POST("/orders", saleCtrl.CreateOrderHandler)
    }
}