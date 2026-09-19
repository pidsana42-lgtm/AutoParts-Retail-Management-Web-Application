package route

import (
	"backend/internal/app/route/auth"
	"backend/internal/app/route/catalog"
	"backend/internal/app/route/claim"
	"backend/internal/app/route/company_setting"
	"backend/internal/app/route/customer"
	"backend/internal/app/route/dashboard"
	"backend/internal/app/route/employee"
	"backend/internal/app/route/import_bill"
	"backend/internal/app/route/notification"
	"backend/internal/app/route/oa"
	"backend/internal/app/route/pos"
	"backend/internal/app/route/pre_order"
	"backend/internal/app/route/purchase_orders"
	returns "backend/internal/app/route/return"
	"backend/internal/app/route/wms"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupAllRoutes(r *gin.Engine, db *gorm.DB) {
	// The stock monitor's post-write middleware must precede all business routes.
	notificationService := notification.SetupNotificationRoutes(r, db)
	wms.SetupStockAlertRoutes(r, db, notificationService)
	// LINE OA routes
	oa.SetupOARoutes(r, db)

	//auth routes
	auth.SetupAuthRoutes(r, db)
	employee.SetupEmployeeRoutes(r, db)

	// dashboard routes
	dashboard.SetupDashboardRoutes(r, db)

	// company setting routes
	company_setting.SetupCompanySettingRoutes(r, db)

	//pos and customer payment routes
	customer.SetupCustomerRoutes(r, db)
	pos.SetupPOSRoutes(r, db)
	pos.SetupStoreConfigRoutes(r, db)
	pos.SetupCustomerDiscountRoutes(r, db)
	pos.SetupPaymentRoutes(r, db, notificationService)
	pos.SetupSalesHistoryRoutes(r, db, notificationService)

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
	purchaseorders.SetupPORoutes(r, db, notificationService)

	// return routes
	returns.SetupReturnRoutes(r, db)

	// wms routes
	wms.SetupProductRoutes(r, db)
	wms.SetupCheckStockScheduleRoutes(r, db, notificationService)
	wms.SetupCheckStockRoutes(r, db)
	wms.SetupStockMovementRoutes(r, db)
	wms.SetupMovementFeedRoutes(r, db)
	wms.SetupSupplierRoutes(r, db)
	wms.SetupCategoryRoutes(r, db)
	wms.SetupSubCategoryRoutes(r, db)
	wms.SetupUnitRoutes(r, db)
	wms.SetupGradeRoutes(r, db)
	wms.SetupZoneRoutes(r, db)
	wms.SetupShelfRoutes(r, db)
	wms.SetupShelfLevelRoutes(r, db)
	wms.SetupSubSubCategoryRoutes(r, db)

	// inventory lots (variant code ต่อบริษัท — ใช้พิมพ์ QR/บาร์โค้ดแยกบริษัท)
	wms.SetupInventoryLotRoutes(r, db)
}
