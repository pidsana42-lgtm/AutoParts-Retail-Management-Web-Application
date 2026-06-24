package claim

import (
	"net/http"

	"backend/config"
	claimDTO "backend/internal/app/dto/claim"
	"github.com/gin-gonic/gin"
)

// CreateSalesReturn สำหรับเพิ่มข้อมูล SalesReturn ใหม่
func CreateSalesReturn(c *gin.Context) {
	var input claimDTO.CreateSalesReturnDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	salesReturn := input.ToEntity()
	if err := config.DB().Create(&salesReturn).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create sales return: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    claimDTO.ToSalesReturnResponseDTO(&salesReturn),
	})
}
