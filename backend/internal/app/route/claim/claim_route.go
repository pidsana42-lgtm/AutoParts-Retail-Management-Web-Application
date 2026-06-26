package claim

import (
	claimCtrl "backend/internal/app/controller/claim"
	claimRepo "backend/internal/app/repository/claim"
	claimSvc "backend/internal/app/service/claim"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupClaimRoutes(r *gin.Engine, db *gorm.DB) {
	// 1. Repositories
	salesReturnRepo := claimRepo.NewSalesReturnRepository(db)
	supplierClaimRepo := claimRepo.NewSupplierClaimRepository(db)
	customerClaimRepo := claimRepo.NewCustomerClaimRepository(db)

	// 2. Services
	salesReturnSvc := claimSvc.NewSalesReturnService(salesReturnRepo)
	supplierClaimSvc := claimSvc.NewSupplierClaimService(supplierClaimRepo)
	customerClaimSvc := claimSvc.NewCustomerClaimService(customerClaimRepo)

	// 3. Controllers
	salesReturnCtrl := claimCtrl.NewSalesReturnController(salesReturnSvc)
	supplierClaimCtrl := claimCtrl.NewSupplierClaimController(supplierClaimSvc)
	customerClaimCtrl := claimCtrl.NewCustomerClaimController(customerClaimSvc)

	api := r.Group("/api")
	claims := api.Group("/claims")
	{
		// Sales Return Routes
		claims.POST("/sales-returns", salesReturnCtrl.CreateSalesReturn)
		claims.POST("/sales-returns/items", salesReturnCtrl.CreateSalesReturnItem)
		claims.GET("/sales-returns/:id", salesReturnCtrl.GetSalesReturnByID)
		claims.GET("/sales-returns", salesReturnCtrl.ListSalesReturns)
		claims.PUT("/sales-returns/:id", salesReturnCtrl.UpdateSalesReturn)
		claims.DELETE("/sales-returns/:id", salesReturnCtrl.DeleteSalesReturn)

		// Supplier Claim Routes
		claims.POST("/supplier-claims", supplierClaimCtrl.CreateSupplierClaim)
		claims.POST("/supplier-claims/items", supplierClaimCtrl.CreateSupplierClaimItem)
		claims.GET("/supplier-claims/:id", supplierClaimCtrl.GetSupplierClaimByID)
		claims.GET("/supplier-claims", supplierClaimCtrl.ListSupplierClaims)
		claims.PUT("/supplier-claims/:id", supplierClaimCtrl.UpdateSupplierClaim)
		claims.DELETE("/supplier-claims/:id", supplierClaimCtrl.DeleteSupplierClaim)

		// Customer Claim Routes
		claims.POST("/customer-claims", customerClaimCtrl.CreateCustomerClaim)
		claims.POST("/customer-claims/items", customerClaimCtrl.CreateCustomerClaimItem)
		claims.GET("/customer-claims/:id", customerClaimCtrl.GetCustomerClaimByID)
		claims.GET("/customer-claims", customerClaimCtrl.ListCustomerClaims)
		claims.PUT("/customer-claims/:id", customerClaimCtrl.UpdateCustomerClaim)
		claims.DELETE("/customer-claims/:id", customerClaimCtrl.DeleteCustomerClaim)
	}
}
