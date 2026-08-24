package dashboard

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"

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

func (ctrl *DashboardController) GetIncomeSummary(c *gin.Context) {
	var query dashDto.SummaryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ query ไม่ถูกต้อง: " + err.Error()})
		return
	}
	data, err := ctrl.svc.GetIncomeSummary(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลรายได้ได้"})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (ctrl *DashboardController) GetTopSellers(c *gin.Context) {
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
	data, err := ctrl.svc.GetTopSellers(c.Request.Context(), query, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลสินค้าขายดีได้"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

func (ctrl *DashboardController) GetDebtAging(c *gin.Context) {
	var query dashDto.DebtAgingQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ query ไม่ถูกต้อง: " + err.Error()})
		return
	}
	result, err := ctrl.svc.GetDebtAging(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดข้อมูลอายุหนี้ได้"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (ctrl *DashboardController) ExportDebtAgingExcel(c *gin.Context) {
	var query dashDto.DebtAgingQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ query ไม่ถูกต้อง"})
		return
	}
	// ดึงข้อมูลทั้งหมด (ไม่ใช้ pagination แต่คงตัวกรองอื่น)
	allQuery := dashDto.DebtAgingQuery{
		StartDate:  query.StartDate,
		EndDate:    query.EndDate,
		Status:     query.Status,
		MinAgeDays: query.MinAgeDays,
		MaxAgeDays: query.MaxAgeDays,
		Page:       1,
		PageSize:   9999,
	}
	result, err := ctrl.svc.GetDebtAging(c.Request.Context(), allQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถส่งออกข้อมูลได้"})
		return
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF") // UTF-8 BOM for Excel
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"รหัสลูกค้า", "ชื่อลูกค้า", "ยอดหนี้ทั้งหมด", "วันที่ซื้อล่าสุด", "อายุหนี้ (วัน)", "สถานะ"})
	for _, item := range result.Data {
		_ = w.Write([]string{
			item.CustomerCode,
			item.CustomerName,
			fmt.Sprintf("%.2f", item.TotalDebt),
			item.LastPurchaseDate,
			strconv.Itoa(item.AgeDays),
			item.Status,
		})
	}
	w.Flush()

	c.Header("Content-Disposition", `attachment; filename="debt-aging.csv"`)
	c.Data(http.StatusOK, "text/csv; charset=utf-8", buf.Bytes())
}

func (ctrl *DashboardController) ExportDebtAgingPdf(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "ยังไม่รองรับการส่งออก PDF"})
}