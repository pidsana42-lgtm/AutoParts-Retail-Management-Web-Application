package claim

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	claimDTO "backend/internal/app/dto/claim"
	"backend/internal/app/enum"
	claimRepo "backend/internal/app/repository/claim"
	claimSvc "backend/internal/app/service/claim"
	"github.com/gin-gonic/gin"
)

type SalesReturnController struct {
	svc claimSvc.SalesReturnService
}

func NewSalesReturnController(svc claimSvc.SalesReturnService) *SalesReturnController {
	return &SalesReturnController{svc: svc}
}

func (ctrl *SalesReturnController) CreateSalesReturn(c *gin.Context) {
	var input claimDTO.CreateSalesReturnDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateSalesReturn(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sales return: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *SalesReturnController) CreateSalesReturnItem(c *gin.Context) {
	var input claimDTO.CreateSalesReturnItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateSalesReturnItem(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sales return item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *SalesReturnController) GetSalesReturnByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.GetSalesReturnByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Sales return not found: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *SalesReturnController) ListSalesReturns(c *gin.Context) {
	res, err := ctrl.svc.ListSalesReturns()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve sales returns: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *SalesReturnController) UpdateSalesReturn(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input claimDTO.UpdateSalesReturnDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.UpdateSalesReturn(uint(id), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update sales return: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Updated successfully",
		"data":    res,
	})
}

func (ctrl *SalesReturnController) DeleteSalesReturn(c *gin.Context) {
	if !requireClaimStaff(c) {
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	// เส้นทางนี้เคยไม่ตรวจสิทธิ์อะไรเลย ต่างจาก DELETE /api/returns/:id ที่ทำงานเดียวกัน
	// กลายเป็นทางลัดข้ามการป้องกัน จึงใช้กฎชุดเดียวกัน: เจ้าของกับผู้จัดการลบได้เสมอ
	// ส่วนพนักงานลบได้เฉพาะใบที่ยังไม่ผ่านการพิจารณา
	if !isOwnerOrManager(c) {
		existing, errGet := ctrl.svc.GetSalesReturnByID(uint(id))
		if errGet != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบรายการคืนสินค้านี้"})
			return
		}
		if !strings.EqualFold(strings.TrimSpace(string(existing.Status)), string(enum.ReturnPending)) {
			c.JSON(http.StatusForbidden, gin.H{"error": "รายการคืนสินค้าที่ผ่านการพิจารณาแล้ว ต้องให้เจ้าของร้านหรือผู้จัดการเป็นผู้ลบ"})
			return
		}
	}

	err = ctrl.svc.DeleteSalesReturn(uint(id))
	if err != nil {
		if errors.Is(err, claimRepo.ErrSalesReturnAlreadyRefunded) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete sales return: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}
