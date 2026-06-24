package import_data

import (
	"net/http"

	"backend/config"
	importDataDTO "backend/internal/app/dto/import_data"
	"github.com/gin-gonic/gin"
)

// CreateBillImage สำหรับเพิ่มข้อมูล BillImage ใหม่
func CreateBillImage(c *gin.Context) {
	var input importDataDTO.CreateBillImageDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	billImage := input.ToEntity()
	if err := config.DB().Create(&billImage).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill image: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    importDataDTO.ToBillImageResponseDTO(&billImage),
	})
}
