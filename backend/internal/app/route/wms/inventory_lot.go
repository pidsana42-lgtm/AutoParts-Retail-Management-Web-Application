package wms

import (
	wmsCtrl "backend/internal/app/controller/wms"
	wmsRepo "backend/internal/app/repository/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupInventoryLotRoutes: เส้นทางจัดการล็อตสินค้าต่อบริษัท (variant code)
// ใช้พิมพ์ QR/บาร์โค้ดแยกบริษัท และ resolve โค้ดที่สแกน
func SetupInventoryLotRoutes(r *gin.Engine, db *gorm.DB) {
	repo := wmsRepo.NewInventoryLotRepository(db)
	service := wmsSvc.NewInventoryLotService(repo)
	controller := wmsCtrl.NewInventoryLotController(service)

	wms := r.Group("/api/wms")
	{
		wms.GET("/inventory-lots", controller.ListLots)
		wms.GET("/inventory-lots/resolve", controller.ResolveCode)
		wms.POST("/inventory-lots/generate-codes", controller.BackfillCodes)
	}
}
