package import_bill

import (
	"backend/internal/app/controller/import_data"
	"github.com/gin-gonic/gin"
)

func RegisterBillRoutes(rg *gin.RouterGroup) {
	importData := rg.Group("/import-data")
	{
		importData.POST("/bill-images", import_data.CreateBillImage)
		importData.POST("/bill-import-jobs", import_data.CreateBillImportJob)
		importData.GET("/bill-import-jobs/:id", import_data.GetBillImportJob)
		importData.POST("/bill-import-jobs/:id/confirm", import_data.ConfirmBillImport)
		importData.POST("/bills", import_data.CreateBill)
		importData.GET("/bills", import_data.ListBills)
		importData.POST("/bill-items", import_data.CreateBillItem)
	}
}
