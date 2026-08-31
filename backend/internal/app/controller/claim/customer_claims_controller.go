package claim

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	claimDTO "backend/internal/app/dto/claim"
	claimSvc "backend/internal/app/service/claim"
	"github.com/gin-gonic/gin"
)

type CustomerClaimController struct {
	svc claimSvc.CustomerClaimService
}

func NewCustomerClaimController(svc claimSvc.CustomerClaimService) *CustomerClaimController {
	return &CustomerClaimController{svc: svc}
}

func (ctrl *CustomerClaimController) CreateCustomerClaim(c *gin.Context) {
	var input claimDTO.CreateCustomerClaimDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// ตรวจสอบ ID ของ User ที่สร้างใบเคลมจาก JWT Token (ไม่เชื่อค่าที่ client ส่งมาเอง)
	// ใช้ตอนแจ้งเตือนกลับตอนเจ้าของร้านอนุมัติ/ตีกลับ จะได้ส่งหาคนที่สร้างจริงๆ (ของเดิม hardcode เป็น user 1 เสมอ)
	var createdBy uint = 1
	if userID, exists := c.Get("user_id"); exists {
		if idFloat, ok := userID.(float64); ok {
			createdBy = uint(idFloat)
		}
	}

	res, err := ctrl.svc.CreateCustomerClaim(input, createdBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *CustomerClaimController) CreateCustomerClaimItem(c *gin.Context) {
	var input claimDTO.CreateCustomerClaimItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateCustomerClaimItem(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer claim item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *CustomerClaimController) GetCustomerClaimByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.GetCustomerClaimByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Customer claim not found: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *CustomerClaimController) ListCustomerClaims(c *gin.Context) {
	res, err := ctrl.svc.ListCustomerClaims()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve customer claims: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *CustomerClaimController) UpdateCustomerClaim(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input claimDTO.UpdateCustomerClaimDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.UpdateCustomerClaim(uint(id), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update customer claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Updated successfully",
		"data":    res,
	})
}

func (ctrl *CustomerClaimController) UpdateCustomerClaimItem(c *gin.Context) {
	idStr := c.Param("itemId")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}
	var input claimDTO.UpdateCustomerClaimItemDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}
	res, err := ctrl.svc.UpdateCustomerClaimItem(uint(id), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated successfully", "data": res})
}

func (ctrl *CustomerClaimController) UpdateCustomerClaimItemStatus(c *gin.Context) {
	idStr := c.Param("itemId")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}
	var input claimDTO.UpdateClaimItemStatusDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}
	res, err := ctrl.svc.UpdateCustomerClaimItemStatus(uint(id), input.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item status: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully", "data": res})
}

func (ctrl *CustomerClaimController) DeleteCustomerClaim(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	err = ctrl.svc.DeleteCustomerClaim(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete customer claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func (ctrl *CustomerClaimController) GeneratePDF(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	pdfBytes, err := ctrl.svc.GenerateCustomerClaimPDF(c.Request.Context(), uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate claim PDF: " + err.Error()})
		return
	}

	fileName := fmt.Sprintf("Claim_%d.pdf", id)
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

func (ctrl *CustomerClaimController) GenerateChecklistPDF(c *gin.Context) {
	status := c.Query("status")
	search := c.Query("search")

	pdfBytes, err := ctrl.svc.GenerateCustomerClaimChecklistPDF(c.Request.Context(), status, search)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate claim checklist PDF: " + err.Error()})
		return
	}

	fileName := fmt.Sprintf("Claim_Checklist_%s.pdf", time.Now().Format("20060102_150405"))
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", fileName))
	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}


