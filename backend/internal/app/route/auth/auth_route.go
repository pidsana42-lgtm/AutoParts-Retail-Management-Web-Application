package auth

import (
	authCtrl "backend/internal/app/controller/auth"
	authRepo "backend/internal/app/repository/auth"
	authSvc "backend/internal/app/service/auth"
	"backend/internal/app/service/email"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupAuthRoutes(r *gin.Engine, db *gorm.DB) {
	userRepo := authRepo.NewUserRepository(db)
	emailService := email.NewEmailService()
	authService := authSvc.NewAuthService(userRepo, emailService)
	authController := authCtrl.NewAuthController(authService)

	authGroup := r.Group("/api/auth")
	{
		authGroup.POST("/login", authController.Login)
		authGroup.GET("/line/callback", authController.LineCallback)
		authGroup.POST("/forgot-password", authController.ForgotPassword)
		authGroup.POST("/reset-password", authController.ResetPassword)
	}
}