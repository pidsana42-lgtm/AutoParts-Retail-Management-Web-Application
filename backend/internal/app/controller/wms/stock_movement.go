package wms

import (
	"net/http"
	"time"

	wmsDto "backend/internal/app/dto/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type StockMovementController struct {
	service wmsSvc.StockMovementService
}

func NewStockMovementController(service wmsSvc.StockMovementService) *StockMovementController {
	return &StockMovementController{service: service}
}

func (ctrl *StockMovementController) Create(c *gin.Context) {
	var req wmsDto.StockMovementRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.Create(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "stock movement recorded successfully"})
}

func (ctrl *StockMovementController) GetByID(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	res, err := ctrl.service.GetByID(uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "stock movement not found"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *StockMovementController) List(c *gin.Context) {
	movementType := c.Query("type") // ?type=IN|OUT|RETURN|CLAIM

	var from, to *time.Time
	if f := c.Query("from"); f != "" {
		if t, err := time.Parse("2006-01-02", f); err == nil {
			from = &t
		}
	}
	if t := c.Query("to"); t != "" {
		if parsed, err := time.Parse("2006-01-02", t); err == nil {
			to = &parsed
		}
	}

	res, err := ctrl.service.List(movementType, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}
