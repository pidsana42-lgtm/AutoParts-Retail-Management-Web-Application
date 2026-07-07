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

		// Custom route for WMS Import Bill flow to fetch categories with preloaded subcategories (Keeps friend's files untouched)
		importDataGroup.GET("/categories-tree", func(c *gin.Context) {
			var categories []entity.Category
			if err := db.Preload("SubCategories").Find(&categories).Error; err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, categories)
		})
	}
}
