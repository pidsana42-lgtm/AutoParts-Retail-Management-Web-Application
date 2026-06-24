package pos

import (
	posCtrl "backend/internal/app/controller/pos"
	posRepo "backend/internal/app/repository/pos"
	posSvc "backend/internal/app/service/pos" 
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPOSRoutes(r *gin.Engine, db *gorm.DB) {
	posProductRepo := posRepo.NewPOSProductRepository(db)
	posProductSvc := posSvc.NewPOSProductService(posProductRepo)
	posProductCtrl := posCtrl.NewPOSProductController(posProductSvc)

	posGroup := r.Group("/api/pos")
	{
		posGroup.GET("/products", posProductCtrl.SearchProducts)
	}
}