package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupShelfRoutes(r *gin.Engine, db *gorm.DB) {
	repo       := wmsRepo.NewShelfRepository(db)
	service    := wmsSvc.NewShelfService(repo)
	controller := wmsCtrl.NewShelfController(service)

	wms := r.Group("/api/wms/shelves")
	{
		wms.POST("", controller.Create)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
		wms.PUT("/:id", controller.Update)
		wms.DELETE("/:id", controller.Delete)
	}
}