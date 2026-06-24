package claim

import (
	"net/http"

	"backend/config"
	claimDTO "backend/internal/app/dto/claim"
	"github.com/gin-gonic/gin"
)

// CreateSupplierClaimItem สำหรับเพิ่มข้อมูล SupplierClaimItem ใหม่
func CreateSupplierClaimItem(c *gin.Context) {
	var input claimDTO.CreateSupplierClaimItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	supplierClaimItem := input.ToEntity()
	if err := config.DB().Create(&supplierClaimItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create supplier claim item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    claimDTO.ToSupplierClaimItemResponseDTO(&supplierClaimItem),
	})
}
