package pos

import (
	"backend/internal/app/dto/pos"
	posService "backend/internal/app/service/pos"
	"net/http"
	"fmt"
	"github.com/gin-gonic/gin"
)

type SaleController struct {
	svc posService.SaleService
}

// NewSaleController ดึง Service เข้ามาทำงานร่วมกัน
func NewSaleController(svc posService.SaleService) *SaleController {
	return &SaleController{svc: svc}
}

// CreateOrderHandler รับก้อน JSON ตะกร้าสินค้าจากปุ่ม "ยืนยันการขาย"
func (c *SaleController) CreateOrderHandler(ctx *gin.Context) {
	var req pos.CreateSaleOrderRequest

	// 1. แกะกล่องข้อมูล (Bind JSON) ตรวจสอบความถูกต้องตามแบบ DTO แล้วเก็บไว้ในตัวแปร req
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "ข้อมูลใบสั่งซื้อไม่ถูกต้องหรือส่งฟิลด์มาไม่ครบ",
			"error":   err.Error(),
		})
		return
	}

	// 2. ส่งข้อมูลดิบทั้งหมดเข้าลูปประมวลผลชั้น Service (คำนวณเงิน, เช็ค StoreConfig, หักสต็อก, บันทึกหนี้)
	if err := c.svc.CreatePOSOrder(&req); err != nil {
		fmt.Println("บันทึกออเดอร์พังเพราะสาเหตุนี้:", err)
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"status":  "error",
			"message": err.Error(),
		})
		return
	}
	
	ctx.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "บันทึกใบสั่งซื้อและอัปเดตสต็อกเรียบร้อยแล้ว",
	})
}