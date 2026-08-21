package catalog

import (
	"net/http"
	"strconv"

	dto "backend/internal/app/dto/catalog"
	service "backend/internal/app/service/catalog"
	"github.com/gin-gonic/gin"
)

type CatalogController struct {
	service service.CatalogService
}

func NewCatalogController(s service.CatalogService) *CatalogController {
	return &CatalogController{service: s}
}

func (c *CatalogController) CreateCatalog(ctx *gin.Context) {
	var input dto.CreateCatalogDTO
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := c.service.CreateCatalog(input)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusCreated, result)
}

func (c *CatalogController) GetCatalogByID(ctx *gin.Context) {
	idParam := ctx.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid catalog ID"})
		return
	}

	result, err := c.service.GetCatalogByID(uint(id))
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Catalog not found"})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *CatalogController) ListCatalogs(ctx *gin.Context) {
	search := ctx.Query("search")
	brand := ctx.Query("brand")
	category := ctx.Query("category")

	result, err := c.service.ListCatalogs(search, brand, category)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *CatalogController) UpdateCatalog(ctx *gin.Context) {
	idParam := ctx.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid catalog ID"})
		return
	}

	var input dto.UpdateCatalogDTO
	if err := ctx.ShouldBindJSON(&input); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := c.service.UpdateCatalog(uint(id), input)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *CatalogController) DeleteCatalog(ctx *gin.Context) {
	idParam := ctx.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "Invalid catalog ID"})
		return
	}

	if err := c.service.DeleteCatalog(uint(id)); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "Catalog deleted successfully"})
}

func (c *CatalogController) SearchItems(ctx *gin.Context) {
	search := ctx.Query("search")
	brand := ctx.Query("brand")

	result, err := c.service.SearchCatalogItems(search, brand)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}
