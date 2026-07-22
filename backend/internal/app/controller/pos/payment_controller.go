package pos

import (
	"net/http"
	posDto "backend/internal/app/dto/pos"
	posService "backend/internal/app/service/pos"

	"github.com/gin-gonic/gin"
)

type PaymentController interface {
	GenerateQR(c *gin.Context)
	ConfirmPayment(c *gin.Context)
}

type paymentController struct {
	paymentService posService.PaymentService
}

func NewPaymentController(paymentService posService.PaymentService) PaymentController {
	return &paymentController{paymentService: paymentService}
}

func (ctrl *paymentController) GenerateQR(c *gin.Context) {
	var req posDto.GenerateQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูล Request ไม่ถูกต้อง"})
		return
	}

	res, err := ctrl.paymentService.GeneratePromptPayQR(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (ctrl *paymentController) ConfirmPayment(c *gin.Context) {
    var req posDto.ConfirmPaymentRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูล Request ไม่ถูกต้อง"})
        return
    }

    // ส่ง req DTO ทั้งหมดเข้าไปใน PaymentService
    res, err := ctrl.paymentService.ConfirmPayment(req)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    c.JSON(http.StatusOK, res)
}