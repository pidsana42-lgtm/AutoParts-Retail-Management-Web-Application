package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"

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
		wms.POST("/brands", controller.CreateBrand)
		wms.GET("/brands", controller.ListBrands)
		wms.PUT("/brands/:id", controller.UpdateBrand)
		wms.DELETE("/brands/:id", controller.DeleteBrand)

		wms.POST("/models", controller.CreateModel)
		wms.PUT("/models/:id", controller.UpdateModel)
		wms.DELETE("/models/:id", controller.DeleteModel)

	}
}
