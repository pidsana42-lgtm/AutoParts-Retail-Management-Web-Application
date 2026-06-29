package wms

import (
	"net/http"
	"strconv"

	wmsDto "backend/internal/app/dto/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type CheckStockController struct {
	service wmsSvc.CheckStockService
}

func NewCheckStockController(service wmsSvc.CheckStockService) *CheckStockController {
	return &CheckStockController{service: service}
}

func (ctrl *CheckStockController) CreateCheckStock(c *gin.Context) {
	var req wmsDto.CheckStockRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.CreateCheckStock(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "check stock recorded successfully"})
}

func (ctrl *CheckStockController) GetByID(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	res, err := ctrl.service.GetByID(uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "check stock not found"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *CheckStockController) List(c *gin.Context) {
	var scheduleID *uint
	if s := c.Query("schedule_id"); s != "" {
		id, err := strconv.ParseUint(s, 10, 64)
		if err == nil {
			uid := uint(id)
			scheduleID = &uid
		}
	}
	res, err := ctrl.service.List(scheduleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
