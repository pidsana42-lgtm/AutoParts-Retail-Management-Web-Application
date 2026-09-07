package pos

import (
	storeconfigCtrl "backend/internal/app/controller/pos"
	storeconfigRepo "backend/internal/app/repository/pos"
	storeconfigSvc "backend/internal/app/service/pos" 

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupStoreConfigRoutes(r *gin.Engine, db *gorm.DB) {
    storeConfigRepo := storeconfigRepo.NewStoreConfigRepository(db)
    storeConfigSvc := storeconfigSvc.NewStoreConfigService(storeConfigRepo)
    storeConfigCtrl := storeconfigCtrl.NewStoreConfigController(storeConfigSvc)

    storeConfigGroup := r.Group("/api/pos/store-config")
    storeConfigGroup.Use(middleware.AuthMiddleware())
    {
        // พนักงานดูค่าตั้งค่าร้านค้าได้ (เพื่อนำไปคำนวณบิล)
        storeConfigGroup.GET("", 
            middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin), string(enum.RoleEmployee)), 
            storeConfigCtrl.GetStoreConfig,
        )

        // สร้างการตั้งค่าร้านค้าครั้งแรก (POST)
        storeConfigGroup.POST("", 
            middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)), 
            storeConfigCtrl.CreateStoreConfig,
        )

        // เฉพาะ Owner/Admin ที่อัปเดตตั้งค่าร้านได้ (PUT)
        storeConfigGroup.PUT("", 
            middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)), 
            storeConfigCtrl.UpdateStoreConfig,
        )

        // ดูประวัติการแก้ไขการตั้งค่า (Audit Logs)
        storeConfigGroup.GET("/audit-logs", 
            middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)), 
            storeConfigCtrl.GetAuditLogs,
        )
    }
}