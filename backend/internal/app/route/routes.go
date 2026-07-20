package route

import (
	"backend/internal/app/route/auth"
	"backend/internal/app/route/claim"
	"backend/internal/app/route/customer"
	"backend/internal/app/route/import_bill"
	"backend/internal/app/route/oa"
	"backend/internal/app/route/pos"
	"backend/internal/app/route/pre_order"
	"backend/internal/app/route/purchase_orders"
	"backend/internal/app/route/wms"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupAllRoutes(r *gin.Engine, db *gorm.DB) {
	// LINE OA routes
	oa.SetupOARoutes(r, db)

	//auth routes
	auth.SetupAuthRoutes(r, db)

	//pos and customer payment routes
	customer.SetupCustomerRoutes(r, db)
	pos.SetupPOSRoutes(r, db)
	pos.SetupStoreConfigRoutes(r, db)
	pos.SetupCustomerDiscountRoutes(r, db)
	pos.SetupPaymentRoutes(r, db)

	//ของทุกคนก็เพิ่มเอาในนี้เลย comment ระบบตัวเองไว้ด้วยนะ ใน main มันจะได้ไ่ม่เยอะ

	//import bill routes
	import_bill.SetupBillRoutes(r, db)
	//claim routes
	claim.SetupClaimRoutes(r, db)
	//pre-order routes
	pre_order.SetupPreOrderRoutes(r, db)

	// purchase orders routes
	purchaseorders.SetupPORoutes(r, db)

	// wms routes
	wms.SetupProductRoutes(r, db)
	wms.SetupCheckStockScheduleRoutes(r, db)
	wms.SetupCheckStockRoutes(r, db)
	wms.SetupStockMovementRoutes(r, db)
	wms.SetupSupplierRoutes(r, db)
	wms.SetupStockAlertRoutes(r, db)
	wms.SetupCategoryRoutes(r, db)
	wms.SetupSubCategoryRoutes(r, db)
	wms.SetupUnitRoutes(r, db)
	wms.SetupZoneRoutes(r, db)
	wms.SetupShelfRoutes(r, db)
	wms.SetupSubSubCategoryRoutes(r, db)
}
