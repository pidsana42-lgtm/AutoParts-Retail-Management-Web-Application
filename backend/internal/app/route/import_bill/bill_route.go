package import_bill

import (
	billCtrl "backend/internal/app/controller/import_data"
	billRepo "backend/internal/app/repository/import_data"
	billSvc "backend/internal/app/service/import_data"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupBillRoutes(r *gin.Engine, db *gorm.DB) {
	// 1. Repository
	repo := billRepo.NewBillRepository(db)

	// 2. Service
	svc := billSvc.NewImportBillService(repo)

	// 3. Controller
	ctrl := billCtrl.NewBillController(svc)

	api := r.Group("/api")
	importData := api.Group("/import-data")
	{
		importData.POST("/bill-images", ctrl.CreateBillImage)
		importData.POST("/bill-import-jobs", ctrl.CreateBillImportJob)
		importData.GET("/bill-import-jobs/:id", ctrl.GetBillImportJob)
		importData.POST("/bill-import-jobs/:id/confirm", ctrl.ConfirmBillImport)
		importData.POST("/bills", ctrl.CreateBill)
		importData.GET("/bills", ctrl.ListBills)
		importData.POST("/bill-items", ctrl.CreateBillItem)
	}
}
