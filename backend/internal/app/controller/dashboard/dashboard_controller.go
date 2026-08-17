package dashboard

import (
	"strconv"
	"net/http"

	dashDto "backend/internal/app/dto/dashboard"
	dashSvc "backend/internal/app/service/dashboard"
	"github.com/gin-gonic/gin"
)

type DashboardController struct {
	svc dashSvc.DashboardService
}

func NewDashboardController(svc dashSvc.DashboardService) *DashboardController {
	return &DashboardController{svc: svc}
}

func (ctrl *DashboardController) GetSummaryData(c *gin.Context) {
	var query dashDto.SummaryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ query ไม่ถูกต้อง: " + err.Error()})
		return
	}

	result, err := ctrl.svc.GetSummaryData(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (ctrl *DashboardController) GetRecentSales(c *gin.Context) {
	var query dashDto.SummaryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ query ไม่ถูกต้อง: " + err.Error()})
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}

	data, err := ctrl.svc.GetRecentSales(c.Request.Context(), query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดรายการขายล่าสุดได้"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (ctrl *DashboardController) GetAgingStock(c *gin.Context) {
	data, err := ctrl.svc.GetAgingStock(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลสินค้าค้างสต๊อกได้"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (ctrl *DashboardController) GetStockHealth(c *gin.Context) {
	data, err := ctrl.svc.GetStockHealth(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลสภาพสินค้าคงคลังได้"})
		return
	}
	c.JSON(http.StatusOK, data)
}