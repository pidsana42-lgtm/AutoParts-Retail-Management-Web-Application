package pos

import (
	posController "backend/internal/app/controller/pos"
	"backend/internal/app/enum"
	posRepository "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"
	svcNotification "backend/internal/app/service/notification"
	"backend/internal/middleware"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupPaymentRoutes(r *gin.Engine, db *gorm.DB, notificationService svcNotification.NotificationService) {
	paymentRepo := posRepository.NewPaymentRepository(db)
	paymentService := posService.NewPaymentService(paymentRepo, notificationService)
	paymentCtrl := posController.NewPaymentController(paymentService)

	paymentGroup := r.Group("/api/pos/payments")
	paymentGroup.Use(
		middleware.AuthMiddleware(),
		middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleEmployee), string(enum.RoleManager)),
	)
	{
		// กระบวนการชำระเงินหน้าร้าน กับ QR
		paymentGroup.POST("/generate-qr", paymentCtrl.GenerateQR)
		paymentGroup.POST("/generate-settle-qr", paymentCtrl.GenerateSettleQR)
		paymentGroup.PATCH("/confirm", paymentCtrl.ConfirmPayment)

		// ระบบเคลียร์บิลเงินเชื่อ 
		// ดึงรายการบิลที่ค้างชำระของลูกค้าคนนั้นๆ มาติ๊กเลือกจ่าย
		paymentGroup.GET("/unpaid-bills/:customer_id", paymentCtrl.GetUnpaidBillsByCustomer)
		// ดึงบิลค้างชำระเฉพาะบิลเดียวด้วยเลขที่คำสั่งซื้อ/บาร์โค้ด
		paymentGroup.GET("/unpaid-order/:order_number", paymentCtrl.GetUnpaidBillByOrderNumber)
		// บันทึกการเคลียร์บิล (รองรับการรวมหลายบิล / จ่ายบางส่วน)
		paymentGroup.POST("/settle-bills", paymentCtrl.SettleCustomerBills)

		// หน้าประวัติการรับชำระเงิน (Payment History)
		paymentGroup.GET("/history", paymentCtrl.GetPaymentHistory)
		paymentGroup.GET("/history/:id", paymentCtrl.GetPaymentHistoryByID)
		paymentGroup.GET("/history/:id/pdf", paymentCtrl.GenerateDebtReceiptPDF)
		paymentGroup.GET("/repayments/:id/pdf", paymentCtrl.GenerateDebtReceiptPDF)
		paymentGroup.GET("/customers/:id/statement-pdf", paymentCtrl.GenerateCustomerStatementPDF)

		// พนักงานส่งคำขอยกเลิกใบเสร็จ (Repayment)
		paymentGroup.POST("/history/:id/request-cancel", paymentCtrl.RequestCancelPaymentReceipt)
		// พนักงานดึงคำขอยกเลิกกลับ (เมื่อยังอยู่สถานะ pending_cancel)
		paymentGroup.POST("/history/:id/cancel-request/revert", paymentCtrl.RevertCancelPaymentReceiptRequest)

		// หน้าประวัติและคำขอยกเลิกการชำระเงิน 
		// ดูประวัติรายการที่เคยถูกยกเลิกไปแล้ว
		paymentGroup.GET("/cancellations", paymentCtrl.GetCancelledPaymentHistory)

		// ส่วนการอนุมัติ / ปฏิเสธ / ยกเลิกโดยเจ้าของร้าน (สงวนสิทธิ์เฉพาะ Owner / Manager)
		ownerOnly := paymentGroup.Group("")
		ownerOnly.Use(middleware.RequireRoles(string(enum.RoleOwner), string(enum.RoleManager)))
		{
			// อนุมัติการยกเลิกใบเสร็จรับเงิน (ทำให้ยอดหนี้กลับมาค้างชำระ)
			ownerOnly.POST("/history/:id/approve-cancel", paymentCtrl.ApproveCancelPaymentReceipt)
			// ปฏิเสธคำขอยกเลิกใบเสร็จรับเงิน
			ownerOnly.POST("/history/:id/reject-cancel", paymentCtrl.RejectCancelPaymentReceipt)
			// ยกเลิกโดยตรงโดยเจ้าของร้าน
			ownerOnly.POST("/history/:id/cancel", paymentCtrl.CancelPaymentReceipt)
		}
	}
}