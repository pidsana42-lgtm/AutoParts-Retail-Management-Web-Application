package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupStockMovementRoutes(r *gin.Engine, db *gorm.DB) {
	repo       := wmsRepo.NewStockMovementRepository(db)
	service    := wmsSvc.NewStockMovementService(repo)
	controller := wmsCtrl.NewStockMovementController(service)

	wms := r.Group("/api/wms/stock-movements")
	{
		wms.POST("", controller.Create)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
	}
}
