package claim

import (
	claimCtrl "backend/internal/app/controller/claim"
	claimRepo "backend/internal/app/repository/claim"
	claimSvc "backend/internal/app/service/claim"

	"backend/internal/middleware"
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


	claimsGroup := r.Group("/api/claims")
	claimsGroup.Use(middleware.AuthMiddleware())
	{
		// Sales Return Routes
		claimsGroup.POST("/sales-returns", salesReturnCtrl.CreateSalesReturn)
		claimsGroup.POST("/sales-returns/items", salesReturnCtrl.CreateSalesReturnItem)
		claimsGroup.GET("/sales-returns/:id", salesReturnCtrl.GetSalesReturnByID)
		claimsGroup.GET("/sales-returns", salesReturnCtrl.ListSalesReturns)
		claimsGroup.PUT("/sales-returns/:id", salesReturnCtrl.UpdateSalesReturn)
		claimsGroup.DELETE("/sales-returns/:id", salesReturnCtrl.DeleteSalesReturn)

		// Supplier Claim Routes
		claimsGroup.POST("/supplier-claims", supplierClaimCtrl.CreateSupplierClaim)
		claimsGroup.POST("/supplier-claims/items", supplierClaimCtrl.CreateSupplierClaimItem)
		claimsGroup.GET("/supplier-claims/:id", supplierClaimCtrl.GetSupplierClaimByID)
		claimsGroup.GET("/supplier-claims", supplierClaimCtrl.ListSupplierClaims)
		claimsGroup.PUT("/supplier-claims/:id", supplierClaimCtrl.UpdateSupplierClaim)
		claimsGroup.DELETE("/supplier-claims/:id", supplierClaimCtrl.DeleteSupplierClaim)

		// Customer Claim Routes
		claimsGroup.POST("/customer-claims", customerClaimCtrl.CreateCustomerClaim)
		claimsGroup.POST("/customer-claims/items", customerClaimCtrl.CreateCustomerClaimItem)
		claimsGroup.GET("/customer-claims/:id", customerClaimCtrl.GetCustomerClaimByID)
		claimsGroup.GET("/customer-claims", customerClaimCtrl.ListCustomerClaims)
		claimsGroup.PUT("/customer-claims/:id", customerClaimCtrl.UpdateCustomerClaim)
		claimsGroup.DELETE("/customer-claims/:id", customerClaimCtrl.DeleteCustomerClaim)
	}
}
