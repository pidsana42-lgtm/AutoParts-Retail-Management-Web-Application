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
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		customerGroup.POST("/register", customerCtrl.RegisterCustomer)
		customerGroup.GET("", customerCtrl.GetAllCustomers)
		customerGroup.GET("/:id", customerCtrl.GetCustomerByID)
		customerGroup.PUT("/:id", customerCtrl.UpdateCustomer)
		customerGroup.PUT("/:id/discount", customerCtrl.UpdateCustomerDiscount)
		customerGroup.GET("/credit/audit-logs", customerCtrl.GetCreditAuditLogs)
		customerGroup.POST("/credit/audit-logs", customerCtrl.CreateCreditAuditLog)
	}
}