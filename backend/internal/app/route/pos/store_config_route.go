package pos

import (
	storeconfigCtrl "backend/internal/app/controller/pos"
	storeconfigRepo "backend/internal/app/repository/pos"
	storeconfigSvc "backend/internal/app/service/pos" 
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupStoreConfigRoutes(r *gin.Engine, db *gorm.DB) {
	storeConfigRepo := storeconfigRepo.NewStoreConfigRepository(db)
	storeConfigSvc := storeconfigSvc.NewStoreConfigService(storeConfigRepo)
	storeConfigCtrl := storeconfigCtrl.NewStoreConfigController(storeConfigSvc)

	storeConfigGroup := r.Group("/api/pos/store-config")
	{
		storeConfigGroup.GET("", storeConfigCtrl.GetStoreConfig)
		storeConfigGroup.PUT("", storeConfigCtrl.UpdateStoreConfig)
	}
}