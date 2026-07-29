package pos

import (
	"backend/internal/app/dto/pos"
	salesHistorySvc"backend/internal/app/service/pos"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SalesHistoryController struct {
	salesHistoryService salesHistorySvc.SalesHistoryService
}

func NewSalesHistoryController(salesHistoryService salesHistorySvc.SalesHistoryService) *SalesHistoryController {
	return &SalesHistoryController{salesHistoryService: salesHistoryService}
}

func (c *SalesHistoryController) GetSalesHistory(ctx *gin.Context) {
	var req pos.SalesHistoryFilterRequest

	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "รูปแบบ Query Parameter ไม่ถูกต้อง",
			"error":   err.Error(),
		})
		return
	}

	result, err := c.salesHistoryService.GetSalesHistory(req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ไม่สามารถดึงประวัติการขายได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงประวัติการขายสำเร็จ",
		"data":    result,
	})
}