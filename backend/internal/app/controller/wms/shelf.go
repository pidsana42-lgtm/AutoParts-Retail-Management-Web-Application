package wms

import (
	"net/http"

	wmsDto "backend/internal/app/dto/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type ShelfController struct {
	service wmsSvc.ShelfService
}

func NewShelfController(service wmsSvc.ShelfService) *ShelfController {
	return &ShelfController{service: service}
}

func (ctrl *ShelfController) Create(c *gin.Context) {
	var req wmsDto.ShelfRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "shelf_name and zone_id are required. zone_id must be > 0"})
		return
	}
	if req.ZoneID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "zone_id must be greater than 0"})
		return
	}
	if err := ctrl.service.Create(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "shelf created successfully"})
}

func (ctrl *ShelfController) GetByID(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}

	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}

	res, err := ctrl.service.GetByID(uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "shelf not found"})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (ctrl *ShelfController) List(c *gin.Context) {
	res, err := ctrl.service.List()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *ShelfController) Update(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}

	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}

	var req wmsDto.ShelfUpdateDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "shelf_name and zone_id are required. zone_id must be > 0"})
		return
	}

	if req.ZoneID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "zone_id must be greater than 0"})
		return
	}

	if err := ctrl.service.Update(uri.ID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "shelf updated successfully"})
}

func (ctrl *ShelfController) Delete(c *gin.Context) {
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

	c.JSON(http.StatusOK, gin.H{"message": "shelf deleted successfully"})
}
