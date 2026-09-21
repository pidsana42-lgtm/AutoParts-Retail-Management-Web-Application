package pos

import (
	customerdiscountCtrl "backend/internal/app/controller/pos"
	customerdiscountRepo "backend/internal/app/repository/pos"
	customerdiscountSvc "backend/internal/app/service/pos" 

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCustomerDiscountRoutes(r *gin.Engine, db *gorm.DB) {
    customerDiscountRepo := customerdiscountRepo.NewCustomerDiscountRepository(db)
    customerDiscountSvc := customerdiscountSvc.NewCustomerDiscountService(customerDiscountRepo)
    customerDiscountCtrl := customerdiscountCtrl.NewCustomerDiscountController(customerDiscountSvc)

    customerDiscountGroup := r.Group("/api/pos/customer-discount")
    customerDiscountGroup.Use(middleware.AuthMiddleware())
    {
        // อนุญาตให้ Employee ดึงข้อมูลลูกค้า/ค้นหาได้ด้วย
        customerDiscountGroup.GET("", 
            middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleManager), string(enum.RoleEmployee)), 
            customerDiscountCtrl.GetCustomerDiscount,
        )

        // ส่วนการบันทึกแก้ไขวงเงิน/ส่วนลดจำนวนมาก สงวนไว้แค่ Owner เท่านั้น
        customerDiscountGroup.PUT("", 
            middleware.RequireRoles(string(enum.RoleOwner)), 
            customerDiscountCtrl.BulkUpdateCustomerDiscounts,
        )
    }
}