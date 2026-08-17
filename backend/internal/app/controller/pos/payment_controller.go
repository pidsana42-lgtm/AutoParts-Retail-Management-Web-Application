package pos

import (
	"net/http"
	posDto "backend/internal/app/dto/pos"
	posService "backend/internal/app/service/pos"

	"strconv" //(String Conversion) ใช้แปลง string → uint

	"github.com/gin-gonic/gin"
)

type PaymentController interface {
	GenerateQR(c *gin.Context)
	ConfirmPayment(c *gin.Context)
	GetUnpaidBillsByCustomer(c *gin.Context)
	SettleCustomerBills(c *gin.Context)
	GetPaymentHistory(c *gin.Context)
	GetPaymentHistoryByID(c *gin.Context)
	GetCancelledPaymentHistory(c *gin.Context)
	CancelPaymentReceipt(c *gin.Context)
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

// ดูรายการบิลค้างชำระของลูกค้า GET /api/pos/payments/unpaid-bills/:customer_id
func (ctrl *paymentController) GetUnpaidBillsByCustomer(c *gin.Context) {
    // ดึง customer_id จาก URL parameter (ที่เลือกมาจาก Dropdown หน้าเว็บ) 
    // ซึ่งส่งมาเป็น string มาแปลงเป็นตัวเลขจำนวนเต็มบวก (uint64 ฐาน 10 ขอบเขต 32-bit)
    customerID, err := strconv.ParseUint(c.Param("customer_id"), 10, 32) // อย่างเรียก /unpaid-bills/1 ก็จะได้ customerID = 1 (uint64) และแปลงเป็น uint32 ได้
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสลูกค้าไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
        return
    }

    res, err := ctrl.paymentService.GetUnpaidBillsByCustomer(uint(customerID))

	// ถ้าเกิดข้อผิดพลาด ส่ง response เป็น JSON พร้อมกับ HTTP Status Code 500 (Internal Server Error) และข้อความ error
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
        return
    }
    c.JSON(http.StatusOK, res)
}

// POST /api/pos/payments/settle-bills การชำระบิลค้างชำระของลูกค้า
func (ctrl *paymentController) SettleCustomerBills(c *gin.Context) {
	var req posDto.SettleBillsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูล Request ไม่ถูกต้อง"})
		return
	}

	res, err := ctrl.paymentService.SettleCustomerBills(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// GET /api/pos/payments/history ดูประวัติการชำระเงินทั้งหมด
func (ctrl *paymentController) GetPaymentHistory(c *gin.Context) {
	search := c.Query("search")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	res, err := ctrl.paymentService.GetPaymentHistory(search, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// GET /api/pos/payments/history/:id ดูประวัติการชำระเงินตาม ID ของใบเสร็จ
func (ctrl *paymentController) GetPaymentHistoryByID(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}
	res, err := ctrl.paymentService.GetPaymentHistoryByID(uint(receiptID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// GET /api/pos/payments/cancellations ดูประวัติการยกเลิกการชำระเงิน
func (ctrl *paymentController) GetCancelledPaymentHistory(c *gin.Context) {
	search := c.Query("search")
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")

	res, err := ctrl.paymentService.GetCancelledPaymentHistory(search, startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

// POST /api/pos/payments/history/:id/cancel ยกเลิกการชำระเงิน
func (ctrl *paymentController) CancelPaymentReceipt(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}
	var req posDto.CancelPaymentReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูล Request ไม่ถูกต้อง"})
		return
	}

	if err := ctrl.paymentService.CancelPaymentReceipt(uint(receiptID), req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ยกเลิกการรับชำระเงินและคืนยอดหนี้สำเร็จ"})
}