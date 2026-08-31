package claim

import (
	claimCtrl "backend/internal/app/controller/claim"
	claimRepo "backend/internal/app/repository/claim"
	claimSvc "backend/internal/app/service/claim"
	svcNotification "backend/internal/app/service/notification"

	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupClaimRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	// 1. Repositories
	salesReturnRepo := claimRepo.NewSalesReturnRepository(db)
	supplierClaimRepo := claimRepo.NewSupplierClaimRepository(db)
	customerClaimRepo := claimRepo.NewCustomerClaimRepository(db)
	saleOrderLookupRepo := claimRepo.NewSaleOrderLookupRepository(db)
	poLookupRepo := claimRepo.NewPOLookupRepository(db)

	// 2. Services
	salesReturnSvc := claimSvc.NewSalesReturnService(salesReturnRepo)
	supplierClaimSvc := claimSvc.NewSupplierClaimService(supplierClaimRepo)
	customerClaimSvc := claimSvc.NewCustomerClaimService(customerClaimRepo, saleOrderLookupRepo, notificationService)

	// 3. Controllers
	salesReturnCtrl := claimCtrl.NewSalesReturnController(salesReturnSvc)
	supplierClaimCtrl := claimCtrl.NewSupplierClaimController(supplierClaimSvc)
	customerClaimCtrl := claimCtrl.NewCustomerClaimController(customerClaimSvc)
	saleOrderLookupCtrl := claimCtrl.NewSaleOrderLookupController(saleOrderLookupRepo)
	poLookupCtrl := claimCtrl.NewPOLookupController(poLookupRepo)
	evidenceUploadCtrl := claimCtrl.NewEvidenceUploadController()


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
		claimsGroup.GET("/customer-claims/export/checklist-pdf", customerClaimCtrl.GenerateChecklistPDF)
		claimsGroup.GET("/customer-claims/:id", customerClaimCtrl.GetCustomerClaimByID)
		claimsGroup.GET("/customer-claims/:id/pdf", customerClaimCtrl.GeneratePDF)
		claimsGroup.GET("/customer-claims", customerClaimCtrl.ListCustomerClaims)
		claimsGroup.PUT("/customer-claims/:id", customerClaimCtrl.UpdateCustomerClaim)
		claimsGroup.PUT("/customer-claims/items/:itemId", customerClaimCtrl.UpdateCustomerClaimItem)
		claimsGroup.PUT("/customer-claims/items/:itemId/status", customerClaimCtrl.UpdateCustomerClaimItemStatus)
		claimsGroup.DELETE("/customer-claims/:id", customerClaimCtrl.DeleteCustomerClaim)

		// Sale Order Lookup (for customer claim form)
		claimsGroup.GET("/sale-orders/search", saleOrderLookupCtrl.SearchSaleOrders)
		claimsGroup.GET("/sale-orders/number/:number", saleOrderLookupCtrl.GetByOrderNumber)

		// PO Lookup (for supplier claim form)
		claimsGroup.GET("/purchase-orders/number/:number", poLookupCtrl.GetByPONumber)

		// Evidence image upload → Supabase Storage
		claimsGroup.POST("/evidence/upload", evidenceUploadCtrl.UploadEvidence)
	}
}
