package auth

import (
	authCtrl "backend/internal/app/controller/auth"
	authRepo "backend/internal/app/repository/auth"
	authSvc "backend/internal/app/service/auth"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupAuthRoutes(r *gin.Engine, db *gorm.DB) {
	userRepo := authRepo.NewUserRepository(db)
	authService := authSvc.NewAuthService(userRepo)
	authController := authCtrl.NewAuthController(authService)

	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/login", authController.Login)
		authGroup.GET("/line/callback", authController.LineCallback)

		// QR ส่วนตัวของพนักงาน: ต้องล็อกอินอยู่ก่อนถึงจะดู/สร้าง token ของตัวเองได้
		authGroup.GET("/qr-token", middleware.AuthMiddleware(), authController.GetQrToken)
		authGroup.POST("/qr-token/regenerate", middleware.AuthMiddleware(), authController.RegenerateQrToken)
		// เอา token จากการสแกน QR มาแลก session ล็อกอินจริง (จุดนี้ต้องเปิดสาธารณะ เพราะมือถือยังไม่ได้ล็อกอิน)
		authGroup.POST("/qr-login", authController.QrLogin)
	}
}