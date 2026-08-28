package returns

import (
	reCtrl "backend/internal/app/controller/return"
	reRepo "backend/internal/app/repository/return"
	reSvc "backend/internal/app/service/return"
	"backend/internal/middleware"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupReturnRoutes(r *gin.Engine, db *gorm.DB) {
	repo := reRepo.NewReturnRepository(db)
	svc := reSvc.NewReturnService(repo)
	ctrl := reCtrl.NewReturnController(svc)

	returnsGroup := r.Group("/api/returns")
	returnsGroup.Use(middleware.AuthMiddleware())
	{
		returnsGroup.GET("", ctrl.GetReturns)
		returnsGroup.GET("/sale-orders/search", ctrl.SearchReturnableSaleOrders)
		returnsGroup.GET("/:id", ctrl.GetReturnByID)
		returnsGroup.POST("", ctrl.CreateSalesReturn)
		returnsGroup.PUT("/:id", ctrl.UpdateSalesReturn)
		returnsGroup.POST("/:id/refund", ctrl.ProcessRefund)
		returnsGroup.DELETE("/:id", ctrl.DeleteSalesReturn)
	}
}
