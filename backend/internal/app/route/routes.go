package route

import (
	"backend/internal/app/route/purchase_orders"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupAllRoutes(r *gin.Engine, db *gorm.DB) {

	//pos and customer routes
	// pos.SetupPOSRoutes(r, db)
	// customer.SetupCustomerRoutes(r, db)

	//ของทุกคนก็เพิ่มเอาในนี้เลย comment ระบบตัวเองไว้ด้วยนะ ใน main มันจะได้ไ่ม่เยอะ

	// purchase orders routes
	purchaseorders.SetupPORoutes(r, db)
}