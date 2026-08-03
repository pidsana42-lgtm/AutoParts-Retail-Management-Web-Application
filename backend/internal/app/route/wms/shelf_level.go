package wms

import (
	wmsController "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupShelfLevelRoutes(r *gin.Engine, db *gorm.DB) {
	repo := wmsRepo.NewShelfLevelRepository(db)
	service := wmsService.NewShelfLevelService(repo)
	controller := wmsController.NewShelfLevelController(service)

	shelfLevelGroup := r.Group("/api/wms/shelf-levels")
	{
		shelfLevelGroup.POST("", controller.CreateShelfLevel)
		shelfLevelGroup.PUT("/:id", controller.UpdateShelfLevel)
		shelfLevelGroup.DELETE("/:id", controller.DeleteShelfLevel)
	}
}
