package dashboard

import (
	"bytes"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	dashDto "backend/internal/app/dto/dashboard"
	dashSvc "backend/internal/app/service/dashboard"
	"github.com/gin-gonic/gin"
)

type DashboardController struct {
	svc dashSvc.DashboardService
}

func writeValidationError(c *gin.Context, err error) {
	c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
}

func positiveIntQuery(c *gin.Context, key string, defaultValue, maximum int) (int, error) {
	raw, exists := c.GetQuery(key)
	if !exists || raw == "" {
		return defaultValue, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return 0, fmt.Errorf("%s must be an integer", key)
	}
	if err := dashDto.ValidatePositiveInt(key, value, maximum); err != nil {
		return 0, err
	}
	return value, nil
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
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		writeValidationError(c, err)
		return
	}

	result, err := ctrl.svc.GetSummaryData(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Employees need operational sales counts and revenue on their dashboard,
	// but cost, gross profit and margin are management-only information. Do the
	// redaction at the API boundary so hidden UI cards cannot be bypassed.
	if roleValue, exists := c.Get("role"); exists {
		if role, ok := roleValue.(string); ok && strings.EqualFold(role, "Employee") {
			for i := range result.SummaryData {
				result.SummaryData[i].TotalCost = 0
				result.SummaryData[i].GrossProfit = 0
				result.SummaryData[i].MarginPercent = 0
			}
		}
	}

	c.JSON(http.StatusOK, result)
}

func (ctrl *DashboardController) GetRecentSales(c *gin.Context) {
	var query dashDto.SummaryQuery
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ query ไม่ถูกต้อง: " + err.Error()})
		return
	}
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		writeValidationError(c, err)
		return
	}

	page, err := positiveIntQuery(c, "page", 1, 0)
	if err != nil {
		writeValidationError(c, err)
		return
	}

	// รองรับ limit เดิมชั่วคราว เพื่อไม่ให้ client รุ่นเก่าพังระหว่าง deploy
	pageSizeKey := "page_size"
	if _, exists := c.GetQuery(pageSizeKey); !exists {
		pageSizeKey = "limit"
	}
	pageSize, err := positiveIntQuery(c, pageSizeKey, 10, 100)
	if err != nil {
		writeValidationError(c, err)
		return
	}

	result, err := ctrl.svc.GetRecentSales(c.Request.Context(), query, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถโหลดรายการขายล่าสุดได้"})
		return
	}
	c.JSON(http.StatusOK, result)
}

func (ctrl *DashboardController) GetAgingStock(c *gin.Context) {
	days, err := positiveIntQuery(c, "days", 180, 0)
	if err != nil {
		writeValidationError(c, err)
		return
	}
	data, err := ctrl.svc.GetAgingStock(c.Request.Context(), days)
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
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		writeValidationError(c, err)
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
	if err := dashDto.ValidateSummaryQuery(query); err != nil {
		writeValidationError(c, err)
		return
	}
	limit, err := positiveIntQuery(c, "limit", 10, 100)
	if err != nil {
		writeValidationError(c, err)
		return
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
	if err := dashDto.ValidateDebtAgingQuery(query); err != nil {
		writeValidationError(c, err)
		return
	}
	if raw, exists := c.GetQuery("page"); exists && raw != "" && query.Page == 0 {
		writeValidationError(c, fmt.Errorf("page must be greater than zero"))
		return
	}
	if raw, exists := c.GetQuery("page_size"); exists && raw != "" && query.PageSize == 0 {
		writeValidationError(c, fmt.Errorf("page_size must be greater than zero"))
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
	if err := dashDto.ValidateDebtAgingQuery(query); err != nil {
		writeValidationError(c, err)
		return
	}
	// ดึงข้อมูลทั้งหมดเป็นชุดละ 100 รายการ เพื่อใช้ validation และไม่เปิดให้
	// endpoint ปกติรับ page_size ขนาดใหญ่เกินไป
	allQuery := dashDto.DebtAgingQuery{
		StartDate:  query.StartDate,
		EndDate:    query.EndDate,
		Status:     query.Status,
		MinAgeDays: query.MinAgeDays,
		MaxAgeDays: query.MaxAgeDays,
		Page:       1,
		PageSize:   100,
	}
	result, err := ctrl.svc.GetDebtAging(c.Request.Context(), allQuery)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถส่งออกข้อมูลได้"})
		return
	}
	allData := append([]dashDto.DebtAgingItemDTO(nil), result.Data...)
	for page := 2; int64((page-1)*allQuery.PageSize) < result.Total; page++ {
		allQuery.Page = page
		next, nextErr := ctrl.svc.GetDebtAging(c.Request.Context(), allQuery)
		if nextErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถส่งออกข้อมูลได้"})
			return
		}
		allData = append(allData, next.Data...)
	}

	var buf bytes.Buffer
	buf.WriteString("\xEF\xBB\xBF") // UTF-8 BOM for Excel
	w := csv.NewWriter(&buf)
	_ = w.Write([]string{"รหัสลูกค้า", "ชื่อลูกค้า", "ยอดหนี้ทั้งหมด", "วันที่ซื้อล่าสุด", "อายุหนี้ (วัน)", "สถานะ"})
	for _, item := range allData {
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
