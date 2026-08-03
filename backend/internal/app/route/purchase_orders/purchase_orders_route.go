package purchaseorders

import (
	poCtrl "backend/internal/app/controller/purchase_orders"
	poRepo "backend/internal/app/repository/purchase_orders"
	poSvc "backend/internal/app/service/purchase_orders" 
	preOrderRepo "backend/internal/app/repository/pre_oder"

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/robfig/cron/v3"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"strconv"
	"context"
	"log"
	"os"
)

// อ่านค่าจำนวนวันหมดอายุของฉบับร่างจาก env กำหนด default ไว้ถ้าไม่ได้ตั้ง/ตั้งผิด
func getPODraftExpiryDays() int {
	days, err := strconv.Atoi(os.Getenv("PO_DRAFT_EXPIRY_DAYS"))
	if err != nil || days <= 0 {
		return 7
	}
	return days
}

func SetupPORoutes(r *gin.Engine, db *gorm.DB) {
	poRepository := poRepo.NewPORepository(db)
	productRepository := poRepo.NewProductRepository(db)
	supplierRepository := poRepo.NewSupplierRepository(db)
	userRepository := poRepo.NewUserRepository(db)
	inventoryRepository := poRepo.NewInventoryRepository(db)
	preOrderRepository := preOrderRepo.NewPreOrderRepository(db)
	draftExpiryDays := getPODraftExpiryDays()
	poService := poSvc.NewPOService(
		poRepository,       // 1. PO Repo
    	productRepository,  // 2. Product Repo
		inventoryRepository,// 3. Inventory Repo
   		supplierRepository, // 4. Supplier Repo
		preOrderRepository,	// 5. PreOrder Repo
    	userRepository,     // 6. User Repo
		draftExpiryDays,
	)

	// สำหรับ ล้างข้อมูลใบสั่งซื้อหมดอายุ
	c := cron.New()
	// Job 1: รันทุกเที่ยงคืน (0 0 * * *) 
	// หน้าที่: ตรวจสอบและดันสถานะ DELETED/RESUBMITTED ไปเป็น EXPIRED
	c.AddFunc("0 0 * * *", func() {
		ctx := context.Background()
		err := poRepository.UpdateStatusToExpired(ctx)
		if err != nil {
			log.Printf("[Cron-Daily] Failed to update status to EXPIRED: %v", err)
		}
	})
	// Job 2: รันตอนเที่ยงคืนของวันที่ 30 ทุกเดือน (0 0 30 * *)
	// หน้าที่: กวาดล้างขยะ EXPIRED ที่หมดเวลากู้คืนแล้วออกจากระบบ
	c.AddFunc("0 0 30 * *", func() {
		ctx := context.Background()
		err := poRepository.HardDeleteExpiredPOs(ctx)
		if err != nil {
			log.Printf("[Cron-Monthly] Failed to hard delete EXPIRED POs: %v", err)
		} else {
			log.Println("[Cron-Monthly] Hard delete cleanup completed")
		}
	})
	c.Start()

	poController := poCtrl.NewPOController(poService)

	poGroup := r.Group("/api/po")
	poGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		// CRUD
		poGroup.POST("/new-po", poController.CreatePO)
		poGroup.PUT("/:id", poController.UpdatePO)
		poGroup.PATCH("/:id/status", poController.UpdateStatus)
		poGroup.DELETE("/:id", poController.DeletePO)
		poGroup.GET("/:id", poController.GetByID)
		// PO Management
		poGroup.GET("/get-all-po", poController.ListPOs)
		poGroup.GET("/summary", poController.GetSummary)
		poGroup.GET("/monthly-count", poController.GetMonthlyCount)
		poGroup.GET("/print/:id", poController.PrintPO)
		// Supplier Delivery Estimate
		poGroup.GET("/suppliers/:supplierId/delivery-estimate", poController.GetSupplierDeliveryEstimate)
		// Search Product
		poGroup.GET("/product-search", poController.SearchProducts)
	}
}