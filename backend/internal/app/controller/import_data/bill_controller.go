package import_data

import (
	"net/http"

	"backend/config"
	importDataDTO "backend/internal/app/dto/import_data"
	"backend/internal/app/entity"
	"github.com/gin-gonic/gin"
)

// CreateBill สำหรับเพิ่มข้อมูล Bill ใหม่
func CreateBill(c *gin.Context) {
	var input importDataDTO.CreateBillDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	bill := input.ToEntity()
	if err := config.DB().Create(&bill).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    importDataDTO.ToBillResponseDTO(&bill),
	})
}

// ListBills สำหรับดึงข้อมูล Bill ทั้งหมด (พร้อมดึงความสัมพันธ์)
func ListBills(c *gin.Context) {
	var bills []entity.Bill

	// Preload ความสัมพันธ์ เช่น BillImage, User, PO
	if err := config.DB().Preload("BillImage").Preload("VerifiedByUser").Preload("PO").Find(&bills).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := make([]importDataDTO.BillResponseDTO, 0, len(bills))
	for i := range bills {
		response = append(response, importDataDTO.ToBillResponseDTO(&bills[i]))
	}

	c.JSON(http.StatusOK, gin.H{"data": response})
}
