package purchaseorders

import (
	poCtrl "backend/internal/app/controller/purchase_orders"
	poRepo "backend/internal/app/repository/purchase_orders"
	poSvc "backend/internal/app/service/purchase_orders"
	preOrderRepo "backend/internal/app/repository/pre_oder"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"
	"backend/internal/app/cron"

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPORoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	poRepository := poRepo.NewPORepository(db)
	productRepository := poRepo.NewProductRepository(db)
	supplierRepository := poRepo.NewSupplierRepository(db)
	userRepository := poRepo.NewUserRepository(db)
	inventoryRepository := poRepo.NewInventoryRepository(db)
	preOrderRepository := preOrderRepo.NewPreOrderRepository(db)
	stockAlertRepository := wmsRepo.NewStockAlertRepository(db)
	poService := poSvc.NewPOService(
		poRepository,
		productRepository,
		inventoryRepository,
		supplierRepository,
		preOrderRepository,
		userRepository,
		stockAlertRepository,
		notificationService,
	)

	cron.StartPOReminderCron(poService)

	poController := poCtrl.NewPOController(poService)

	poGroup := r.Group("/api/po")
	poGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		// CRUD
		poGroup.POST("/new-po", poController.CreatePO)
		poGroup.PUT("/:id", poController.UpdatePO)
		poGroup.PATCH("/:id/status", poController.UpdateStatus)
		poGroup.PATCH("/:id/restore", poController.RestorePO)
		poGroup.DELETE("/:id", poController.DeletePO)
		poGroup.GET("/:id", poController.GetByID)
		// PO Management
		poGroup.GET("/get-all-po", poController.ListPOs)
		poGroup.GET("/available-years", poController.GetAvailableYears)
		poGroup.GET("/summary", poController.GetSummary)
		poGroup.GET("/monthly-count", poController.GetMonthlyCount)
		poGroup.GET("/print/:id", poController.PrintPO)
		// Supplier Delivery Estimate
		poGroup.GET("/suppliers/:supplierId/delivery-estimate", poController.GetSupplierDeliveryEstimate)
		// Search Product
		poGroup.GET("/product-search", poController.SearchProducts)
	}
}
