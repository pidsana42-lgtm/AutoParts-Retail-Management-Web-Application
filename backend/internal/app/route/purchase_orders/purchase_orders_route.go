package purchaseorders

import (
	poCtrl "backend/internal/app/controller/purchase_orders"
	poRepo "backend/internal/app/repository/purchase_orders"
	poSvc "backend/internal/app/service/purchase_orders" 

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPORoutes(r *gin.Engine, db *gorm.DB) {
	poRepository := poRepo.NewPORepository(db)
	productRepository := poRepo.NewProductRepository(db)
	supplierRepository := poRepo.NewSupplierRepository(db)
	poService := poSvc.NewPOService(
		poRepository,       // 1. PO Repo (ส่งปกติ)
    	productRepository,  // 2. Product Repo (คอมเมนต์ไว้ ส่ง nil ไปก่อนเพื่อให้ผ่าน)
   		supplierRepository, // 3. Supplier Repo (ส่งตัวที่เพิ่งสร้างใหม่เข้าไป)
    	nil,                // 4. User Repo (คอมเมนต์ไว้ ส่ง nil ไปก่อนเพื่อให้ผ่าน)
	)
	poController := poCtrl.NewPOController(poService)

	posGroup := r.Group("/api/po")
	posGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		posGroup.POST("/new-purchase-orders", poController.CreatePO)
	}
}