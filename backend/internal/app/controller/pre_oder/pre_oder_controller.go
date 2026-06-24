package pre_order

import (
	"net/http"

	"backend/config"
	preOrderDTO "backend/internal/app/dto/pre_oder"
	"github.com/gin-gonic/gin"
)

// CreatePreOrder สำหรับเพิ่มข้อมูล PreOrder ใหม่
func CreatePreOrder(c *gin.Context) {
	var input preOrderDTO.CreatePreOrderDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	preOrder := input.ToEntity()
	if err := config.DB().Create(&preOrder).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pre-order: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    preOrderDTO.ToPreOrderResponseDTO(&preOrder),
	})
}
