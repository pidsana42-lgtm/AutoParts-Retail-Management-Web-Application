package pos

import (
	customerdiscountCtrl "backend/internal/app/controller/pos"
	customerdiscountRepo "backend/internal/app/repository/pos"
	customerdiscountSvc "backend/internal/app/service/pos" 
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCustomerDiscountRoutes(r *gin.Engine, db *gorm.DB) {
	customerDiscountRepo := customerdiscountRepo.NewCustomerDiscountRepository(db)
	customerDiscountSvc := customerdiscountSvc.NewCustomerDiscountService(customerDiscountRepo)
	customerDiscountCtrl := customerdiscountCtrl.NewCustomerDiscountController(customerDiscountSvc)

	customerDiscountGroup := r.Group("/api/pos/customer-discount")
	{
		customerDiscountGroup.GET("", customerDiscountCtrl.GetCustomerDiscount)
		customerDiscountGroup.PUT("", customerDiscountCtrl.BulkUpdateCustomerDiscounts)
	}
}