package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupMovementFeedRoutes(r *gin.Engine, db *gorm.DB) {
	repo := wmsRepo.NewMovementFeedRepository(db)
	service := wmsSvc.NewMovementFeedService(repo)
	controller := wmsCtrl.NewMovementFeedController(service)

	wms := r.Group("/api/wms/movement-feed")
	{
		wms.GET("", controller.List)
	}
}
