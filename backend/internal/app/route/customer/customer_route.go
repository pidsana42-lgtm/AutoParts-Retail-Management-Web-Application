package customer

import (
	customerCtrl "backend/internal/app/controller/customer"
	customerRepo "backend/internal/app/repository/customer"
	customerSvc "backend/internal/app/service/customer"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupCustomerRoutes(r *gin.Engine, db *gorm.DB) {
	customerRepo := customerRepo.NewCustomerRepository(db)
	customerSvc := customerSvc.NewCustomerService(customerRepo, db)
	customerCtrl := customerCtrl.NewCustomerController(customerSvc)

	customerGroup := r.Group("/api/customers")
	{
		customerGroup.POST("/register", customerCtrl.RegisterCustomer)
		customerGroup.GET("", customerCtrl.GetAllCustomers)
		customerGroup.GET("/:id", customerCtrl.GetCustomerByID)
	}
}