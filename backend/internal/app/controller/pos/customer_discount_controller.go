package pos

import (
	customerdiscountDto "backend/internal/app/dto/pos"
	customerdiscountSvc "backend/internal/app/service/pos" 
	"net/http"
	"github.com/gin-gonic/gin"
)

type CustomerDiscountController struct {
	svc customerdiscountSvc.CustomerDiscountService 
}

func NewCustomerDiscountController(svc customerdiscountSvc.CustomerDiscountService) *CustomerDiscountController {
	return &CustomerDiscountController{svc: svc}
}

func (ctrl *CustomerDiscountController) GetCustomerDiscount(c *gin.Context) {
	searchQuery := c.Query("search")
	discounts, err := ctrl.svc.GetCustomerDiscount(searchQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถดึงข้อมูลส่วนลดลูกค้าได้: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, discounts)
}

func (ctrl *CustomerDiscountController) BulkUpdateCustomerDiscounts(c *gin.Context) {

	var req customerdiscountDto.BulkUpdateCustomerDiscountRequest

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูลส่วนลดไม่ถูกต้อง: " + err.Error()})
		return
	}

	if err := ctrl.svc.BulkUpdateCustomerDiscounts(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกการเปลี่ยนแปลงได้: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "บันทึกการตั้งค่าสิทธิ์และส่วนลดลูกค้าอู่สำเร็จเรียบร้อยแล้ว"})
}