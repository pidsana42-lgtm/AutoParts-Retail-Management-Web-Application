package wms

import (
	wmsDto "backend/internal/app/dto/wms"
	wmsService "backend/internal/app/service/wms"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ShelfLevelController interface {
	CreateShelfLevel(c *gin.Context)
	UpdateShelfLevel(c *gin.Context)
	DeleteShelfLevel(c *gin.Context)
}

type shelfLevelController struct {
	service wmsService.ShelfLevelService
}

func NewShelfLevelController(service wmsService.ShelfLevelService) ShelfLevelController {
	return &shelfLevelController{service: service}
}

func (ctrl *shelfLevelController) CreateShelfLevel(c *gin.Context) {
	var req wmsDto.ShelfLevelRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.Create(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "Shelf level created successfully"})
}

func (ctrl *shelfLevelController) UpdateShelfLevel(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var req wmsDto.ShelfLevelUpdateDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.Update(uint(id), &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Shelf level updated successfully"})
}

func (ctrl *shelfLevelController) DeleteShelfLevel(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := ctrl.service.Delete(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Shelf level deleted successfully"})
}
