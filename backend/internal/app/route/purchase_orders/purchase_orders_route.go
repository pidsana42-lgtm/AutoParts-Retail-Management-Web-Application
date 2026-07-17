package purchaseorders

import (
	poCtrl "backend/internal/app/controller/purchase_orders"
	poRepo "backend/internal/app/repository/purchase_orders"
	poSvc "backend/internal/app/service/purchase_orders" 

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"strconv"
	"os"
)

// อ่านค่าจำนวนวันหมดอายุของฉบับร่างจาก env กำหนด default ไว้ถ้าไม่ได้ตั้ง/ตั้งผิด
func getPODraftExpiryDays() int {
	days, err := strconv.Atoi(os.Getenv("PO_DRAFT_EXPIRY_DAYS"))
	if err != nil || days <= 0 {
		return 7
	}
	return days
}

func SetupPORoutes(r *gin.Engine, db *gorm.DB) {
	poRepository := poRepo.NewPORepository(db)
	productRepository := poRepo.NewProductRepository(db)
	supplierRepository := poRepo.NewSupplierRepository(db)
	userRepository := poRepo.NewUserRepository(db)
	inventoryRepository := poRepo.NewInventoryRepository(db)
	draftExpiryDays := getPODraftExpiryDays()
	poService := poSvc.NewPOService(
		poRepository,       // 1. PO Repo
    	productRepository,  // 2. Product Repo
		inventoryRepository,// 3. Inventory Repo
   		supplierRepository, // 4. Supplier Repo
    	userRepository,     // 5. User Repo
		draftExpiryDays,
	)
	poController := poCtrl.NewPOController(poService)

	poGroup := r.Group("/api/po")
	poGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		// CRUD
		poGroup.POST("/new-purchase-orders", poController.CreatePO)
		poGroup.PUT("/:id", poController.UpdatePO)
		poGroup.PATCH("/:id/status", poController.UpdateStatus)
		poGroup.DELETE("/:id", poController.DeletePO)
		poGroup.GET("/:id", poController.GetByID)
		// PO Management
		poGroup.GET("/get-all-po", poController.ListPOs)
		poGroup.GET("/summary", poController.GetSummary)
		poGroup.GET("/monthly-count", poController.GetMonthlyCount)
		poGroup.GET("/print/:id", poController.PrintPO)
		// Supplier Delivery Estimate
		poGroup.GET("/suppliers/:supplierId/delivery-estimate", poController.GetSupplierDeliveryEstimate)
		// Search Product
		poGroup.GET("/product-search", poController.SearchProducts)
	}
}