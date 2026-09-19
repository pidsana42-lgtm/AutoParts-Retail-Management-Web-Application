package company_setting

import (
	ctrl "backend/internal/app/controller/company_setting"
	"backend/internal/app/enum"
	repo "backend/internal/app/repository/company_setting"
	svc "backend/internal/app/service/company_setting"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCompanySettingRoutes(r *gin.Engine, db *gorm.DB) {
	repository := repo.NewCompanySettingRepository(db)
	service := svc.NewCompanySettingService(repository)
	controller := ctrl.NewCompanySettingController(service)

	group := r.Group("/api/company-setting")
	group.Use(middleware.AuthMiddleware())
	{
		// Owner, Admin, Employee สามารถดูข้อมูลร้านค้าได้
		group.GET("",
			middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin), string(enum.RoleEmployee)),
			controller.GetCompanySetting,
		)

		// เฉพาะ Owner, Admin ที่สามารถอัปเดตข้อมูลร้านค้าได้
		group.PUT("",
			middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)),
			controller.UpdateCompanySetting,
		)

		// เฉพาะ Owner, Admin ที่สามารถดูข้อมูลการชำระเงินแบบถอดรหัสเต็มได้ (Unmask / Reveal)
		group.GET("/payment/reveal",
			middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)),
			controller.RevealPaymentSetting,
		)

		// เฉพาะ Owner, Admin ที่สามารถอัปโหลดโลโก้ได้
		group.POST("/logo",
			middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)),
			controller.UploadLogo,
		)
	}
}
