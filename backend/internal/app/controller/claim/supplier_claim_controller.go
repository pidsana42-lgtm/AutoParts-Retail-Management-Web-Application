package claim

import (
	"net/http"

	"backend/config"
	claimDTO "backend/internal/app/dto/claim"
	"github.com/gin-gonic/gin"
)

// CreateSupplierClaim สำหรับเพิ่มข้อมูล SupplierClaim ใหม่
func CreateSupplierClaim(c *gin.Context) {
	var input claimDTO.CreateSupplierClaimDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	supplierClaim := input.ToEntity()
	if err := config.DB().Create(&supplierClaim).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create supplier claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    claimDTO.ToSupplierClaimResponseDTO(&supplierClaim),
	})
}
