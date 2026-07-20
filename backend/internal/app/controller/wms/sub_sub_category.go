package wms

import (
	"net/http"
	"strconv"

	wmsDto "backend/internal/app/dto/wms"
	wmsSvc "backend/internal/app/service/wms"

	"github.com/gin-gonic/gin"
)

type SubSubCategoryController struct{
	service wmsSvc.SubSubCategoryService
}

func NewSubSubCategoryController(service wmsSvc.SubSubCategoryService) *SubSubCategoryController {
	return &SubSubCategoryController{service: service}
}

func (ctrl *SubSubCategoryController) Create(c *gin.Context) {
	var req wmsDto.SubSubCategoryRequestDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.Create(&req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, gin.H{"message": "sub sub category created successfully"})
}

func (ctrl *SubSubCategoryController) GetByID(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	res, err := ctrl.service.GetByID(uri.ID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "sub sub category not found"})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *SubSubCategoryController) List(c *gin.Context) {
	var subcategoryID *uint
	if catID := c.Query("sub_category_id"); catID != "" {
		id, err := strconv.ParseUint(catID, 10, 64)
		if err == nil {
			uid := uint(id)
			subcategoryID = &uid
		}
	}
	res, err := ctrl.service.List(subcategoryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *SubSubCategoryController) Update(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	var req wmsDto.SubSubCategoryUpdateDTO
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := ctrl.service.Update(uri.ID, &req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "sub sub category updated successfully"})
}

func (ctrl *SubSubCategoryController) Delete(c *gin.Context) {
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
	c.JSON(http.StatusOK, gin.H{"message": "sub sub category deleted successfully"})
}