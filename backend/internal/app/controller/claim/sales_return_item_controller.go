package claim

import (
	"net/http"

	"backend/config"
	claimDTO "backend/internal/app/dto/claim"
	"github.com/gin-gonic/gin"
)

// CreateSalesReturnItem สำหรับเพิ่มข้อมูล SalesReturnItem ใหม่
func CreateSalesReturnItem(c *gin.Context) {
	var input claimDTO.CreateSalesReturnItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	salesReturnItem := input.ToEntity()
	if err := config.DB().Create(&salesReturnItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sales return item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    claimDTO.ToSalesReturnItemResponseDTO(&salesReturnItem),
	})
}
