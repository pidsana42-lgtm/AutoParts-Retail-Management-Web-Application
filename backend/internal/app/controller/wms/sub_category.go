package wms

import (
	"net/http"
	"strconv"

	wmsDto "backend/internal/app/dto/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type SubCategoryController struct {
	service wmsSvc.SubCategoryService
}

func NewSubCategoryController(service wmsSvc.SubCategoryService) *SubCategoryController {
	return &SubCategoryController{service: service}
}

func (ctrl *SubCategoryController) Create(c *gin.Context) {
	var req wmsDto.SubCategoryRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.Create(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "sub category created successfully"})
}

func (ctrl *SubCategoryController) GetByID(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	res, err := ctrl.service.GetByID(uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "sub category not found"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *SubCategoryController) List(c *gin.Context) {
	var categoryID *uint
	if catID := c.Query("category_id"); catID != "" {
		id, err := strconv.ParseUint(catID, 10, 64)
		if err == nil {
			uid := uint(id)
			categoryID = &uid
		}
	}
	res, err := ctrl.service.List(categoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *SubCategoryController) Update(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	var req wmsDto.SubCategoryUpdateDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.Update(uri.ID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "sub category updated successfully"})
}

func (ctrl *SubCategoryController) Delete(c *gin.Context) {
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
	c.JSON(http.StatusOK, gin.H{"message": "sub category deleted successfully"})
}