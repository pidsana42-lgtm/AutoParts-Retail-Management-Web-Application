package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc  "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupStockAlertRoutes(r *gin.Engine, db *gorm.DB) {
	repo       := wmsRepo.NewStockAlertRepository(db)
	service    := wmsSvc.NewStockAlertService(repo)
	controller := wmsCtrl.NewStockAlertController(service)

	wms := r.Group("/api/wms/stock-alerts")
	{
		wms.POST("", controller.Create)
		wms.GET("", controller.List)
		wms.GET("/:id", controller.GetByID)
		wms.PATCH("/:id/resolve", controller.UpdateResolved)
	}
}
