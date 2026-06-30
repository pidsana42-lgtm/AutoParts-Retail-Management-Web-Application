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

// 🎯 ปรับแก้จาก (c *SaleController) เป็น (ctrl *SaleController) ให้เหมือนกันทั้งไฟล์
func (ctrl *SaleController) CreateOrderHandler(ctx *gin.Context) {
	var req pos.CreateSaleOrderRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"status":  "error",
			"message": "ข้อมูลใบสั่งซื้อไม่ถูกต้องหรือส่งฟิลด์มาไม่ครบ",
			"error":   err.Error(),
		})
		return
	}

	if err := ctrl.svc.CreatePOSOrder(&req); err != nil {
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

// ─── 🎯 GET /pos/customer-types ───
func (ctrl *SaleController) GetCustomerTypes(c *gin.Context) {
	customerTypes, err := ctrl.svc.GetCustomerTypes()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ✅ เรียกผ่านแพ็กเกจที่เราอ้างชื่อย่อ (Alias) ไว้ในกลุ่ม Import ด้านบน
	c.JSON(http.StatusOK, customerDto.ToCustomerTypeListResponse(customerTypes))
}

// ─── 🎯 GET /pos/customer-discount ───
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