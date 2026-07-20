package pos

import (
	customerDto "backend/internal/app/dto/customer" // ✨ 1. เพิ่ม Import แพ็กเกจดีทีโอของลูกค้า
	"backend/internal/app/dto/pos"
	posService "backend/internal/app/service/pos"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SaleController struct {
	svc posService.SaleService
}

// NewSaleController ดึง Service เข้ามาทำงานร่วมกัน
func NewSaleController(svc posService.SaleService) *SaleController {
	return &SaleController{svc: svc}
}

func (ctrl *SaleController) CreateOrderHandler(ctx *gin.Context) {
	var req pos.CreateSaleOrderRequest

	//// 1. Bind JSON 
    if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "ข้อมูลใบสั่งซื้อไม่ถูกต้องหรือส่งฟิลด์มาไม่ครบ",
			"error":   err.Error(),
		})
		return
	}

    // 2. ดึง user_id จาก Middleware (ค่านี้มาจาก JWT)
    userIDFloat, exists := ctx.Get("user_id")
    if !exists {
        ctx.JSON(http.StatusUnauthorized, gin.H{"status": "error", "message": "ไม่พบข้อมูลพนักงานในระบบ"})
        return
    }
    
    // แปลง float64 (จาก jwt.MapClaims) เป็น uint
    userID := uint(userIDFloat.(float64))

    // 3. ส่ง req และ userID เข้าไปใน Service
    if err := ctrl.svc.CreatePOSOrder(&req, userID); err != nil {
		fmt.Println("บันทึกออเดอร์พังเพราะสาเหตุนี้:", err)
		ctx.JSON(http.StatusBadRequest, gin.H{
        "message": err.Error(),
    })
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "บันทึกใบสั่งซื้อและอัปเดตสต็อกเรียบร้อยแล้ว",
	})
}

func (ctrl *SaleController) GetCustomerTypes(c *gin.Context) {
	customerTypes, err := ctrl.svc.GetCustomerTypes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, customerDto.ToCustomerTypeListResponse(customerTypes))
}

func (ctrl *SaleController) SearchCustomerDiscount(c *gin.Context) {
	searchQuery := c.Query("search")
	if searchQuery == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุชื่อหรือเบอร์โทรศัพท์ที่ต้องการค้นหา"})
		return
	}

	customers, err := ctrl.svc.SearchCustomers(searchQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในการค้นหาข้อมูล: " + err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, customers)
}

func (ctrl *SaleController) GetPaymentMethods(c *gin.Context) {
	paymentMethods, err := ctrl.svc.GetPaymentMethods()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "เกิดข้อผิดพลาดในการดึงข้อมูลวิธีชำระเงิน: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, paymentMethods)
}