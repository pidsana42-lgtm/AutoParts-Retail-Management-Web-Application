package claim

import (
	claimCtrl "backend/internal/app/controller/claim"
	claimRepo "backend/internal/app/repository/claim"
	claimSvc "backend/internal/app/service/claim"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupCustomerClaimRoutes รับพารามิเตอร์ RouterGroup และ DB เข้ามา
func SetupCustomerClaimRoutes(r *gin.RouterGroup, db *gorm.DB) {
	// 1. สร้าง Repository สำหรับ Customer Claim โดยเฉพาะ
	customerClaimRepo := claimRepo.NewCustomerClaimRepository(db)
	
	// 2. สร้าง Service โดยส่ง Repository เข้าไป (คุณต้องไปสร้างไฟล์ Service นี้ด้วยนะ)
	customerClaimSvc := claimSvc.NewCustomerClaimService(customerClaimRepo)
	
	// 3. สร้าง Controller โดยส่ง Service เข้าไป
	customerClaimCtrl := claimCtrl.NewCustomerClaimController(customerClaimSvc)

	// 4. กำหนดกลุ่มของ Route (แยกออกจาก Supplier Claim)
	customerClaimGroup := r.Group("/customer-claims")
	{
		// สร้างข้อมูลการเคลมของลูกค้า
		customerClaimGroup.POST("/", customerClaimCtrl.CreateCustomerClaim)
		
		// ดึงข้อมูลการเคลมทั้งหมด
		customerClaimGroup.GET("/", customerClaimCtrl.ListCustomerClaims)
		
		// ดึงข้อมูลการเคลมตาม ID
		customerClaimGroup.GET("/:id", customerClaimCtrl.GetCustomerClaimByID)
		
		// อัปเดตข้อมูลการเคลม
		customerClaimGroup.PUT("/:id", customerClaimCtrl.UpdateCustomerClaim)
		
		// ลบข้อมูลการเคลม
		customerClaimGroup.DELETE("/:id", customerClaimCtrl.DeleteCustomerClaim)
	}
}