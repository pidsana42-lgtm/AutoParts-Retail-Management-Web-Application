package pos

import (
	posController "backend/internal/app/controller/pos"
	posRepository "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPaymentRoutes(r *gin.Engine, db *gorm.DB) {
	paymentRepo := posRepository.NewPaymentRepository(db)
	paymentService := posService.NewPaymentService(paymentRepo)
	paymentCtrl := posController.NewPaymentController(paymentService)

	api := r.Group("/api/pos")
	{
		api.POST("/payments/generate-qr", paymentCtrl.GenerateQR)
		api.PATCH("/payments/confirm", paymentCtrl.ConfirmPayment)
	}
}