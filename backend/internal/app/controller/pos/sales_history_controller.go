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

func (c *SalesHistoryController) GetSaleHistoryByID(ctx *gin.Context) {
    identifier := ctx.Param("id")
    if identifier == "" {
        ctx.JSON(http.StatusBadRequest, gin.H{
            "message": "กรุณาระบุรหัสรายการขายหรือเลขที่ใบเสร็จ",
            "error":   "Identifier parameter is required",
        })
        return
    }

    reqCtx := ctx.Request.Context()
    result, err := c.salesHistoryService.GetSaleHistoryByID(reqCtx, identifier)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, gin.H{
            "message": "ไม่สามารถดึงข้อมูลรายละเอียดรายการขายได้",
            "error":   err.Error(),
        })
        return
    }

    ctx.JSON(http.StatusOK, gin.H{
        "message": "ดึงข้อมูลรายละเอียดรายการขายสำเร็จ",
        "data":    result,
    })
}

// พนักงานส่งคำขอยกเลิก
func (c *SalesHistoryController) RequestCancelSale(ctx *gin.Context) {
	identifier := ctx.Param("id")
	var req pos.RequestCancelOrderRequest

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "กรุณาระบุเหตุผลในการขอยกเลิก",
			"error":   err.Error(),
		})
		return
	}

	if err := c.salesHistoryService.RequestCancelSale(ctx.Request.Context(), identifier, req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "ไม่สามารถส่งคำขอยกเลิกรายการได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ส่งคำขอยกเลิกรายการสำเร็จ รอการอนุมัติจากเจ้าของร้าน",
	})
}

// เจ้าของร้านอนุมัติ
func (c *SalesHistoryController) ApproveCancelSale(ctx *gin.Context) {
	identifier := ctx.Param("id")
	var req pos.ProcessCancelOrderRequest
	_ = ctx.ShouldBindJSON(&req)

	if err := c.salesHistoryService.ApproveCancelSale(ctx.Request.Context(), identifier, req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "ไม่สามารถอนุมัติการยกเลิกได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "อนุมัติการยกเลิกรายการและคืนสต็อกสินค้าเรียบร้อยแล้ว",
	})
}

// เจ้าของร้านปฏิเสธ
func (c *SalesHistoryController) RejectCancelSale(ctx *gin.Context) {
	identifier := ctx.Param("id")
	var req pos.ProcessCancelOrderRequest
	_ = ctx.ShouldBindJSON(&req)

	if err := c.salesHistoryService.RejectCancelSale(ctx.Request.Context(), identifier, req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "ไม่สามารถปฏิเสธการยกเลิกได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ปฏิเสธคำขอยกเลิกรายการเรียบร้อยแล้ว",
	})
}

func (c *SalesHistoryController) GetCancellationRequests(ctx *gin.Context) {
    var req pos.SalesHistoryFilterRequest
    if err := ctx.ShouldBindQuery(&req); err != nil {
        ctx.JSON(http.StatusBadRequest, gin.H{
            "message": "รูปแบบ Query Parameter ไม่ถูกต้อง",
            "error":   err.Error(),
        })
        return
    }

    result, err := c.salesHistoryService.GetCancellationRequests(ctx.Request.Context(), req)
    if err != nil {
        ctx.JSON(http.StatusInternalServerError, gin.H{
            "message": "ไม่สามารถดึงข้อมูลรายการคำขอยกเลิกได้",
            "error":   err.Error(),
        })
        return
    }

    ctx.JSON(http.StatusOK, gin.H{
        "message": "ดึงข้อมูลรายการคำขอยกเลิกสำเร็จ",
        "data":    result,
    })
}

func (c *SalesHistoryController) GetMyCancellationRequests(ctx *gin.Context) {
	userIDFloat, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{
			"message": "ไม่พบข้อมูลพนักงานในระบบ",
		})
		return
	}
	userID := uint(userIDFloat.(float64))

	var req pos.SalesHistoryFilterRequest
	if err := ctx.ShouldBindQuery(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{
			"message": "รูปแบบ Query Parameter ไม่ถูกต้อง",
			"error":   err.Error(),
		})
		return
	}

	result, err := c.salesHistoryService.GetMyCancellationRequests(ctx.Request.Context(), userID, req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{
			"message": "ไม่สามารถดึงข้อมูลรายการคำขอยกเลิกของฉันได้",
			"error":   err.Error(),
		})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"message": "ดึงข้อมูลรายการคำขอยกเลิกของฉันสำเร็จ",
		"data":    result,
	})
}