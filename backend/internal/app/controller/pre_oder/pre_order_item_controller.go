package pre_order

import (
	"net/http"

	"backend/config"
	preOrderDTO "backend/internal/app/dto/pre_oder"
	"github.com/gin-gonic/gin"
)

// CreatePreOrderItem สำหรับเพิ่มข้อมูล PreOrderItem ใหม่
func CreatePreOrderItem(c *gin.Context) {
	var input preOrderDTO.CreatePreOrderItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	preOrderItem := input.ToEntity()
	if err := config.DB().Create(&preOrderItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pre-order item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    preOrderDTO.ToPreOrderItemResponseDTO(&preOrderItem),
	})
}
