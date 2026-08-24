package wms

import (
	"net/http"

	wmsDto "backend/internal/app/dto/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type CheckStockScheduleController struct {
	service wmsSvc.CheckStockScheduleService
}

func NewCheckStockScheduleController(service wmsSvc.CheckStockScheduleService) *CheckStockScheduleController {
	return &CheckStockScheduleController{service: service}
}

func (ctrl *CheckStockScheduleController) CreateSchedule(c *gin.Context) {
	var req wmsDto.CheckStockScheduleRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	id, err := ctrl.service.CreateSchedule(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "schedule created successfully", "id": id})
}

func (ctrl *CheckStockScheduleController) UpdateSchedule(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	var req wmsDto.CheckStockScheduleRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.Update(uri.ID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "schedule updated successfully"})
}

func (ctrl *CheckStockScheduleController) GetByID(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	res, err := ctrl.service.GetByID(uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "schedule not found"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *CheckStockScheduleController) UpdateStatus(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	var body struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.UpdateStatus(uri.ID, body.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "status updated successfully"})
}

func (ctrl *CheckStockScheduleController) Approve(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	if err := ctrl.service.ApproveSchedule(uri.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "อนุมัติผลนับสต็อกและบันทึกลงคลังสินค้าสำเร็จ"})
}

func (ctrl *CheckStockScheduleController) Reject(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	var body struct {
		Note string `json:"note"`
	}
	// note เป็น optional จึงไม่เช็ค error จากการ bind (ไม่ส่ง body มาก็ได้)
	_ = c.ShouldBindJSON(&body)
	if err := ctrl.service.RejectSchedule(uri.ID, body.Note); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "ตีกลับให้นับสต็อกใหม่สำเร็จ"})
}

func (ctrl *CheckStockScheduleController) Delete(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	if err := ctrl.service.Delete(uri.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "schedule deleted successfully"})
}

func (ctrl *CheckStockScheduleController) List(c *gin.Context) {
	status := c.Query("status") // ?status=pending หรือ ?status=completed หรือเว้นว่างเพื่อดูทั้งหมด
	res, err := ctrl.service.List(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *CheckStockScheduleController) ListEmployees(c *gin.Context) {
	res, err := ctrl.service.ListEmployees()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Map to simple response
	var out []map[string]interface{}
	for _, u := range res {
		out = append(out, map[string]interface{}{
			"id": u.ID,
			"first_name": u.FirstName,
			"last_name": u.LastName,
			"full_name": u.FirstName + " " + u.LastName,
		})
	}
	c.JSON(http.StatusOK, out)
}

func (ctrl *CheckStockScheduleController) GetZoneTree(c *gin.Context) {
	res, err := ctrl.service.GetZoneTree()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *CheckStockScheduleController) GetCategoryTree(c *gin.Context) {
	res, err := ctrl.service.GetCategoryTree()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
