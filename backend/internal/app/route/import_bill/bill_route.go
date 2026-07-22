package import_bill

import (
	billCtrl "backend/internal/app/controller/import_data"
	billRepo "backend/internal/app/repository/import_data"
	billSvc "backend/internal/app/service/import_data"

	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupBillRoutes(r *gin.Engine, db *gorm.DB) {
	// 1. Repository
	repo := billRepo.NewBillRepository(db)

	// 2. Service
	svc := billSvc.NewImportBillService(repo)

	// 3. Controller
	ctrl := billCtrl.NewBillController(svc)

	
	importDataGroup := r.Group("/api/import-data")
	importDataGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		importDataGroup.POST("/bill-images", ctrl.CreateBillImage)
		importDataGroup.POST("/bill-import-jobs", ctrl.CreateBillImportJob)
		importDataGroup.GET("/bill-import-jobs/:id", ctrl.GetBillImportJob)
		importDataGroup.POST("/bill-import-jobs/:id/confirm", ctrl.ConfirmBillImport)
		importDataGroup.POST("/bills", ctrl.CreateBill)
		importDataGroup.GET("/bills", ctrl.ListBills)
		importDataGroup.PUT("/bills/:id", ctrl.UpdateBill)
		importDataGroup.DELETE("/bills/:id", ctrl.DeleteBill)
		importDataGroup.POST("/bill-items", ctrl.CreateBillItem)
		importDataGroup.GET("/purchase-orders", ctrl.ListPurchaseOrders)
		importDataGroup.GET("/purchase-orders/:id", ctrl.GetPurchaseOrderById)

		// Custom route for WMS Import Bill flow to fetch categories with preloaded subcategories (Keeps friend's files untouched)
		importDataGroup.GET("/categories-tree", func(c *gin.Context) {
			var categories []entity.Category
			if err := db.Preload("SubCategories").Find(&categories).Error; err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, categories)
		})

		// Custom route to update product cost price directly from import bill workflow
		importDataGroup.PUT("/products/:id/cost-price", func(c *gin.Context) {
			var uri struct {
				ID uint `uri:"id" binding:"required"`
			}
			if err := c.ShouldBindUri(&uri); err != nil {
				c.JSON(400, gin.H{"error": "invalid product ID format"})
				return
			}
			var req struct {
				CostPrice float64 `json:"cost_price" binding:"required,gt=0"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				c.JSON(400, gin.H{"error": err.Error()})
				return
			}
			if err := db.Model(&entity.Product{}).Where("id = ?", uri.ID).Update("cost_price", req.CostPrice).Error; err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, gin.H{"message": "product cost price updated successfully"})
		})
	}

	// Fallback route alias for purchase-orders directly under /api/
	apiGroup := r.Group("/api")
	apiGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		apiGroup.GET("/purchase-orders", ctrl.ListPurchaseOrders)
		apiGroup.GET("/purchase-orders/:id", ctrl.GetPurchaseOrderById)
	}
}
