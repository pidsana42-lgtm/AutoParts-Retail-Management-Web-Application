package auth

import (
	authCtrl "backend/internal/app/controller/auth"
	authRepo "backend/internal/app/repository/auth"
	authSvc "backend/internal/app/service/auth"
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
	}
}