package pos

import (
	"net/http"
	"strconv" //(String Conversion) ใช้แปลง string → uint
	"strings"

	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/enum"
	posService "backend/internal/app/service/pos"

	"github.com/gin-gonic/gin"
)

type PaymentController interface {
	GenerateQR(c *gin.Context)
	GenerateSettleQR(c *gin.Context)
	ConfirmPayment(c *gin.Context)
	GetUnpaidBillsByCustomer(c *gin.Context)
	GetUnpaidBillByOrderNumber(c *gin.Context)
	SettleCustomerBills(c *gin.Context)
	GetPaymentHistory(c *gin.Context)
	GetPaymentHistoryByID(c *gin.Context)
	GetCancelledPaymentHistory(c *gin.Context)
	RequestCancelPaymentReceipt(c *gin.Context)
	RevertCancelPaymentReceiptRequest(c *gin.Context)
	ApproveCancelPaymentReceipt(c *gin.Context)
	RejectCancelPaymentReceipt(c *gin.Context)
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

func (ctrl *paymentController) GenerateSettleQR(c *gin.Context) {
	var req posDto.GenerateSettleQRRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูล Request ไม่ถูกต้อง"})
		return
	}

	res, err := ctrl.paymentService.GenerateSettleQR(req)
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

// ดูรายการบิลค้างชำระเจาะจงเฉพาะบิลเดียว GET /api/pos/payments/unpaid-order/:order_number
func (ctrl *paymentController) GetUnpaidBillByOrderNumber(c *gin.Context) {
    orderNumber := c.Param("order_number")
    if orderNumber == "" {
        c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเลขที่บิล"})
        return
    }

    res, err := ctrl.paymentService.GetUnpaidBillByOrderNumber(orderNumber)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
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

	roleVal, exists := c.Get("role")
	var isOwnerOrAdmin bool
	if exists {
		if roleStr, ok := roleVal.(string); ok {
			if strings.EqualFold(roleStr, string(enum.RoleOwner)) || strings.EqualFold(roleStr, string(enum.RoleAdmin)) {
				isOwnerOrAdmin = true
			}
		}
	}

	var employeeID uint = 0
	if !isOwnerOrAdmin {
		// ถ้าเป็นพนักงาน ให้เห็นเฉพาะรายการที่ตนเองเป็นผู้รับเงิน/บันทึกรายการ
		userIDVal, exists := c.Get("user_id")
		if exists {
			switch v := userIDVal.(type) {
			case float64:
				employeeID = uint(v)
			case uint:
				employeeID = v
			case int:
				employeeID = uint(v)
			case int64:
				employeeID = uint(v)
			}
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลสิทธิ์ของผู้ใช้งานในระบบ"})
			return
		}
	} else {
		// ถ้าเป็น Owner/Admin และมีการระบุ employee_id มาใน query string
		if empParam := c.Query("employee_id"); empParam != "" {
			if empID, err := strconv.ParseUint(empParam, 10, 32); err == nil {
				employeeID = uint(empID)
			}
		}
	}

	res, err := ctrl.paymentService.GetPaymentHistory(search, startDate, endDate, employeeID)
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

	roleVal, exists := c.Get("role")
	var isOwnerOrAdmin bool
	if exists {
		if roleStr, ok := roleVal.(string); ok {
			if strings.EqualFold(roleStr, string(enum.RoleOwner)) || strings.EqualFold(roleStr, string(enum.RoleAdmin)) {
				isOwnerOrAdmin = true
			}
		}
	}

	if !isOwnerOrAdmin {
		userIDVal, exists := c.Get("user_id")
		if exists {
			var userID uint
			switch v := userIDVal.(type) {
			case float64:
				userID = uint(v)
			case uint:
				userID = v
			case int:
				userID = uint(v)
			case int64:
				userID = uint(v)
			}
			if res.ReceivedByID > 0 && res.ReceivedByID != userID {
				c.JSON(http.StatusForbidden, gin.H{"error": "คุณไม่มีสิทธิ์เข้าถึงรายการชำระเงินของพนักงานท่านอื่น"})
				return
			}
		}
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

// POST /api/pos/payments/history/:id/request-cancel พนักงานส่งคำขอยกเลิกใบเสร็จ (Repayment)
func (ctrl *paymentController) RequestCancelPaymentReceipt(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}

	var req posDto.RequestCancelPaymentReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลในการขอยกเลิกใบเสร็จรับเงิน"})
		return
	}

	if strings.TrimSpace(req.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลในการขอยกเลิกใบเสร็จรับเงิน"})
		return
	}

	// ดึง User ID จาก Token Context
	var currentUserID uint
	if userIDVal, exists := c.Get("user_id"); exists {
		switch v := userIDVal.(type) {
		case float64:
			currentUserID = uint(v)
		case uint:
			currentUserID = v
		case int:
			currentUserID = uint(v)
		case int64:
			currentUserID = uint(v)
		}
	}

	if currentUserID == 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้งานในระบบ"})
		return
	}

	// ตรวจสอบว่ารายการนี้เป็น Direct Payment หรือไม่
	repayment, err := ctrl.paymentService.GetPaymentHistoryByID(uint(receiptID))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if repayment.PaymentType == "payment" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รายการชำระเงินสดหน้าร้านไม่สามารถขอยกเลิกจากหน้านี้ได้ กรุณาไปทำรายการที่ 'ประวัติการขายสินค้า' (Sales History) แทน เพื่อความถูกต้องของสต็อกสินค้า"})
		return
	}

	// ตรวจสอบ Role ถ้าเป็นพนักงาน ต้องเป็นรายการที่ตนเองบันทึก
	roleVal, exists := c.Get("role")
	var isOwnerOrAdmin bool
	if exists {
		if roleStr, ok := roleVal.(string); ok {
			if strings.EqualFold(roleStr, string(enum.RoleOwner)) || strings.EqualFold(roleStr, string(enum.RoleAdmin)) {
				isOwnerOrAdmin = true
			}
		}
	}
	if !isOwnerOrAdmin && repayment.ReceivedByID > 0 && repayment.ReceivedByID != currentUserID {
		c.JSON(http.StatusForbidden, gin.H{"error": "คุณไม่มีสิทธิ์ส่งคำขอยกเลิกรายการรับชำระเงินของพนักงานท่านอื่น"})
		return
	}

	if err := ctrl.paymentService.RequestCancelPaymentReceipt(uint(receiptID), currentUserID, req.Reason); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ส่งคำขอยกเลิกใบเสร็จรับเงินไปยังเจ้าของร้านเรียบร้อยแล้ว"})
}

// POST /api/pos/payments/history/:id/cancel-request/revert พนักงานดึงคำขอยกเลิกกลับ
func (ctrl *paymentController) RevertCancelPaymentReceiptRequest(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}

	var currentUserID uint
	if userIDVal, exists := c.Get("user_id"); exists {
		switch v := userIDVal.(type) {
		case float64:
			currentUserID = uint(v)
		case uint:
			currentUserID = v
		case int:
			currentUserID = uint(v)
		case int64:
			currentUserID = uint(v)
		}
	}

	roleVal, exists := c.Get("role")
	var isOwnerOrAdmin bool
	if exists {
		if roleStr, ok := roleVal.(string); ok {
			if strings.EqualFold(roleStr, string(enum.RoleOwner)) || strings.EqualFold(roleStr, string(enum.RoleAdmin)) {
				isOwnerOrAdmin = true
			}
		}
	}

	if err := ctrl.paymentService.RevertCancelPaymentReceiptRequest(uint(receiptID), currentUserID, isOwnerOrAdmin); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ดึงคำขอยกเลิกใบเสร็จรับเงินกลับเรียบร้อยแล้ว"})
}

// POST /api/pos/payments/history/:id/approve-cancel เจ้าของร้านอนุมัติการยกเลิกใบเสร็จ (คืนยอดหนี้)
func (ctrl *paymentController) ApproveCancelPaymentReceipt(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}

	var req posDto.ProcessCancelPaymentReceiptRequest
	_ = c.ShouldBindJSON(&req) // Remark เป็น Optional

	var currentUserID uint
	if userIDVal, exists := c.Get("user_id"); exists {
		switch v := userIDVal.(type) {
		case float64:
			currentUserID = uint(v)
		case uint:
			currentUserID = v
		case int:
			currentUserID = uint(v)
		case int64:
			currentUserID = uint(v)
		}
	}

	if err := ctrl.paymentService.ApproveCancelPaymentReceipt(uint(receiptID), currentUserID, req.Remark); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "อนุมัติการยกเลิกใบเสร็จรับเงินและคืนยอดหนี้สำเร็จ"})
}

// POST /api/pos/payments/history/:id/reject-cancel เจ้าของร้านปฏิเสธคำขอยกเลิกใบเสร็จ
func (ctrl *paymentController) RejectCancelPaymentReceipt(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}

	var req posDto.ProcessCancelPaymentReceiptRequest
	_ = c.ShouldBindJSON(&req)

	if err := ctrl.paymentService.RejectCancelPaymentReceipt(uint(receiptID), req.Remark); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "ปฏิเสธคำขอยกเลิกใบเสร็จรับเงินเรียบร้อยแล้ว"})
}

// POST /api/pos/payments/history/:id/cancel ยกเลิกการชำระเงิน (Direct Cancel หรือสำหรับ Owner)
func (ctrl *paymentController) CancelPaymentReceipt(c *gin.Context) {
	receiptID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสใบเสร็จไม่ถูกต้อง (ต้องเป็นตัวเลข)"})
		return
	}
	var req posDto.CancelPaymentReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลในการยกเลิกใบเสร็จรับเงิน"})
		return
	}

	if strings.TrimSpace(req.Reason) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุเหตุผลในการยกเลิกใบเสร็จรับเงิน"})
		return
	}

	// บล็อกการยกเลิกกรณีเป็นเงินสดหน้าร้าน (Direct Payment)
	if strings.EqualFold(req.PaymentType, "payment") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รายการชำระเงินสดหน้าร้านไม่สามารถยกเลิกจากหน้านี้ได้ กรุณาไปทำรายการที่ 'ประวัติการขายสินค้า' (Sales History) แทน เพื่อความถูกต้องของสต็อกสินค้า"})
		return
	}

	var currentUserID uint = req.CancelledByID
	if userIDVal, exists := c.Get("user_id"); exists {
		switch v := userIDVal.(type) {
		case float64:
			currentUserID = uint(v)
		case uint:
			currentUserID = v
		case int:
			currentUserID = uint(v)
		case int64:
			currentUserID = uint(v)
		}
	}
	if currentUserID == 0 {
		currentUserID = 1
	}
	req.CancelledByID = currentUserID

	if err := ctrl.paymentService.CancelPaymentReceipt(uint(receiptID), req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ยกเลิกการรับชำระเงินและคืนยอดหนี้สำเร็จ"})
}