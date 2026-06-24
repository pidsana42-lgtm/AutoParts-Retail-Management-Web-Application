package import_data

import (
	"net/http"

	"backend/config"
	importDataDTO "backend/internal/app/dto/import_data"
	"github.com/gin-gonic/gin"
)

// CreateBillItem สำหรับเพิ่มข้อมูล BillItem ใหม่
func CreateBillItem(c *gin.Context) {
	var input importDataDTO.CreateBillItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	billItem := input.ToEntity()
	if err := config.DB().Create(&billItem).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    importDataDTO.ToBillItemResponseDTO(&billItem),
	})
}
