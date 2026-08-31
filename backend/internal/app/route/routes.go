package route

import (
	"backend/internal/app/route/auth"
	"backend/internal/app/route/catalog"
	"backend/internal/app/route/claim"
	"backend/internal/app/route/customer"
	"backend/internal/app/route/dashboard"
	"backend/internal/app/route/import_bill"
	"backend/internal/app/route/notification"
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

	// dashboard routes
	dashboard.SetupDashboardRoutes(r, db)

	// notification routes (กระดิ่งแจ้งเตือน) — ต้อง setup ก่อน wms เพราะ check-stock ต้องใช้ service ตัวนี้ยิงแจ้งเตือน
	notificationService := notification.SetupNotificationRoutes(r, db)

	//pos and customer payment routes
	customer.SetupCustomerRoutes(r, db)
	pos.SetupPOSRoutes(r, db)
	pos.SetupStoreConfigRoutes(r, db)
	pos.SetupCustomerDiscountRoutes(r, db)
	pos.SetupPaymentRoutes(r, db)
	pos.SetupSalesHistoryRoutes(r, db)

	//ของทุกคนก็เพิ่มเอาในนี้เลย comment ระบบตัวเองไว้ด้วยนะ ใน main มันจะได้ไ่ม่เยอะ

	//import bill routes
	import_bill.SetupBillRoutes(r, db, notificationService)
	//claim routes
	claim.SetupClaimRoutes(r, db, notificationService)
	//pre-order routes
	pre_order.SetupPreOrderRoutes(r, db, notificationService)
	//catalog routes
	catalog.SetupCatalogRoutes(r, db)

	// purchase orders routes
	purchaseorders.SetupPORoutes(r, db)

	// wms routes
	wms.SetupProductRoutes(r, db)
	wms.SetupCheckStockScheduleRoutes(r, db, notificationService)
	wms.SetupCheckStockRoutes(r, db)
	wms.SetupStockMovementRoutes(r, db)
	wms.SetupMovementFeedRoutes(r, db)
	wms.SetupSupplierRoutes(r, db)
	wms.SetupStockAlertRoutes(r, db)
	wms.SetupCategoryRoutes(r, db)
	wms.SetupSubCategoryRoutes(r, db)
	wms.SetupUnitRoutes(r, db)
	wms.SetupGradeRoutes(r, db)
	wms.SetupZoneRoutes(r, db)
	wms.SetupShelfRoutes(r, db)
	wms.SetupShelfLevelRoutes(r, db)
	wms.SetupSubSubCategoryRoutes(r, db)
}
