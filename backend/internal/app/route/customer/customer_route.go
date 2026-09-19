package customer

import (
	customerCtrl "backend/internal/app/controller/customer"
	customerRepo "backend/internal/app/repository/customer"
	customerSvc "backend/internal/app/service/customer"

	"backend/internal/app/enum"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCustomerRoutes(r *gin.Engine, db *gorm.DB) {
	customerRepo := customerRepo.NewCustomerRepository(db)
	customerSvc := customerSvc.NewCustomerService(customerRepo, db)
	customerCtrl := customerCtrl.NewCustomerController(customerSvc)

	customerGroup := r.Group("/api/customers")
	customerGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		customerGroup.POST("/register", customerCtrl.RegisterCustomer)
		customerGroup.GET("", customerCtrl.GetAllCustomers)
		customerGroup.GET("/:id", customerCtrl.GetCustomerByID)
		customerGroup.PUT("/:id", customerCtrl.UpdateCustomer)
		customerGroup.PUT("/:id/discount", middleware.RequireRoles(string(enum.RoleOwner)), customerCtrl.UpdateCustomerDiscount)
		customerGroup.GET("/credit/audit-logs", middleware.RequireRoles(string(enum.RoleOwner)), customerCtrl.GetCreditAuditLogs)
		customerGroup.POST("/credit/audit-logs", middleware.RequireRoles(string(enum.RoleOwner)), customerCtrl.CreateCreditAuditLog)

		// Protected Route ป้องกันรูปบัตรประชาชนรั่วไหล (ต้องมี Token และสิทธิ์ Owner, Employee หรือ Manager)
		customerGroup.GET("/document/view", customerCtrl.GetCustomerDocumentByPath)
		customerGroup.GET("/:id/document", customerCtrl.GetCustomerDocument)
	}
}