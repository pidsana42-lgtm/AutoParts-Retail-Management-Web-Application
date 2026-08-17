package pos

import (
	posController "backend/internal/app/controller/pos"
	"backend/internal/app/enum"
	posRepository "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPaymentRoutes(r *gin.Engine, db *gorm.DB) {
	paymentRepo := posRepository.NewPaymentRepository(db)
	paymentService := posService.NewPaymentService(paymentRepo)
	paymentCtrl := posController.NewPaymentController(paymentService)

	paymentGroup := r.Group("/api/pos/payments")
	paymentGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleAdmin)),
	)
	{
		// กระบวนการชำระเงินหน้าร้าน กับ QR
		paymentGroup.POST("/generate-qr", paymentCtrl.GenerateQR)
		paymentGroup.PATCH("/confirm", paymentCtrl.ConfirmPayment)

		// ระบบเคลียร์บิลเงินเชื่อ 
		// ดึงรายการบิลที่ค้างชำระของลูกค้าคนนั้นๆ มาติ๊กเลือกจ่าย
		paymentGroup.GET("/unpaid-bills/:customer_id", paymentCtrl.GetUnpaidBillsByCustomer)
		// บันทึกการเคลียร์บิล (รองรับการรวมหลายบิล / จ่ายบางส่วน)
		paymentGroup.POST("/settle-bills", paymentCtrl.SettleCustomerBills)

		// หน้าประวัติการรับชำระเงิน (Payment History)
		paymentGroup.GET("/history", paymentCtrl.GetPaymentHistory)
		paymentGroup.GET("/history/:id", paymentCtrl.GetPaymentHistoryByID)

		// หน้าประวัติและคำขอยกเลิกการชำระเงิน 
		// ดูประวัติรายการที่เคยถูกยกเลิกไปแล้ว
		paymentGroup.GET("/cancellations", paymentCtrl.GetCancelledPaymentHistory)

		// ส่วนการกดยกเลิกใบเสร็จ/การชำระเงิน (สงวนสิทธิ์เฉพาะ Owner / Admin)
		ownerOnly := paymentGroup.Group("")
		ownerOnly.Use(middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleAdmin)))
		{
			// ยกเลิกสลิป/ใบเสร็จรับเงิน (ทำให้ยอดหนี้กลับมาค้างชำระ)
			ownerOnly.POST("/history/:id/cancel", paymentCtrl.CancelPaymentReceipt)
		}
	}
}