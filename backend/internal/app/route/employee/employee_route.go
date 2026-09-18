package employee

import (
	employeeController "backend/internal/app/controller/employee"
	"backend/internal/app/enum"
	employeeService "backend/internal/app/service/employee"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupEmployeeRoutes(r *gin.Engine, db *gorm.DB) {
	service := employeeService.NewService(db)
	controller := employeeController.NewController(service)

	group := r.Group("/api/employees")
	group.Use(middleware.AuthMiddleware(), middleware.RequireRoles(string(enum.RoleOwner)))
	{
		group.GET("", controller.List)
		group.GET("/registration-metadata", controller.GetRegistrationMetadata)
		group.POST("/:id/details", controller.GetDetails)
		group.PUT("/:id", controller.Update)
		group.POST("/:id/avatar", controller.UploadAvatar)
		group.POST("", controller.Create)
	}
}
