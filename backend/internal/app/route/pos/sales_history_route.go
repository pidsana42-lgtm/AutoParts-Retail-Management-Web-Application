package pos

import (
	salesHistoryCtrl "backend/internal/app/controller/pos"
	"backend/internal/app/enum"
	salesHistoryRepo "backend/internal/app/repository/pos"
	salesHistorySvc "backend/internal/app/service/pos"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupSalesHistoryRoutes(r *gin.Engine, db *gorm.DB) {
	repo := salesHistoryRepo.NewSalesHistoryRepository(db)
	svc := salesHistorySvc.NewSalesHistoryService(repo)
	ctrl := salesHistoryCtrl.NewSalesHistoryController(svc)

	salesGroup := r.Group("/api/pos")
	salesGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		salesGroup.GET("/sales/history", ctrl.GetSalesHistory)
		salesGroup.GET("/sales-history/:id", ctrl.GetSaleHistoryByID)
		salesGroup.POST("/sales-history/:id/request-cancel", ctrl.RequestCancelSale)
		// เพิ่มพนักงานดูรายการคำขอยกเลิกบิลของตนเอง
		salesGroup.GET("/my-cancellation-requests", ctrl.GetMyCancellationRequests)
		// พนักงานยกเลิกคำขอยกเลิกบิล (ดึงคำขอกลับ เมื่อบิลยังอยู่สถานะ PENDING_CANCEL)
		salesGroup.POST("/sales-history/:id/cancel-request/revert", ctrl.RevertCancellationRequest)
		// ดึงรายชื่อพนักงานในแผนก POS
		salesGroup.GET("/employees", ctrl.GetEmployees)

		// ส่วนสิทธิ์ของ Owner/Admin ค่อยแตก Group ย่อยออกมาจาก salesGroup อีกที
		ownerOnly := salesGroup.Group("")
		ownerOnly.Use(middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)))
		{
			// เพิ่มดูคำขอยกเลิกบิลทั้งหมด (กรองตาม status เช่น PENDING ได้)
            ownerOnly.GET("/cancellation-requests", ctrl.GetCancellationRequests)
			ownerOnly.POST("/sales-history/:id/approve-cancel", ctrl.ApproveCancelSale)
			ownerOnly.POST("/sales-history/:id/reject-cancel", ctrl.RejectCancelSale)
		}
	}
}