package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"
	"backend/internal/app/entity"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupProductRoutes(r *gin.Engine, db *gorm.DB) {
	repo       := wmsRepo.NewProductRepository(db)
	service    := wmsSvc.NewProductService(repo)
	controller := wmsCtrl.NewProductController(service)

	wms := r.Group("/api/wms")
	{
		wms.POST("/products", controller.CreateProduct)
		wms.GET("/products", controller.ListProducts)
		wms.GET("/products/:id", controller.GetProductByID)
		wms.PUT("/products/:id", controller.UpdateProduct)
		wms.DELETE("/products/:id", controller.DeleteProduct)

		// Static fetch for categories and sub-categories
		wms.GET("/categories", func(c *gin.Context) {
			var categories []entity.Category
			if err := db.Preload("SubCategories").Find(&categories).Error; err != nil {
				c.JSON(500, gin.H{"error": err.Error()})
				return
			}
			c.JSON(200, categories)
		})
	}
}
