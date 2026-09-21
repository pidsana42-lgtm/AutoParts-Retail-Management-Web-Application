package claim

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	claimDTO "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"
	claimSvc "backend/internal/app/service/claim"
	"github.com/gin-gonic/gin"
)

type CustomerClaimController struct {
	svc claimSvc.CustomerClaimService
}

func NewCustomerClaimController(svc claimSvc.CustomerClaimService) *CustomerClaimController {
	return &CustomerClaimController{svc: svc}
}

func getRoleFromContext(c *gin.Context) string {
	if val, exists := c.Get("role"); exists {
		if role, ok := val.(string); ok {
			return strings.ToUpper(strings.TrimSpace(role))
		}
	}
	return ""
}

func isOwnerOrAdmin(c *gin.Context) bool {
	role := getRoleFromContext(c)
	return role == "OWNER" || role == "ADMIN"
}

func (ctrl *CustomerClaimController) CreateCustomerClaim(c *gin.Context) {
	var input claimDTO.CreateCustomerClaimDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}
	if !prepareClaimStatus(c, &input.Status, true) {
		return
	}
	for _, item := range input.Items {
		if err := item.ValidateQuantity(); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
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
		if errors.Is(err, claimRepo.ErrClaimQuantityExceedsOrder) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, claimRepo.ErrOrderInProgress) {
			c.JSON(http.StatusConflict, gin.H{"error": "sale order is already being claimed or returned"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create customer claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *CustomerClaimController) CreateCustomerClaimItem(c *gin.Context) {
	if !requireClaimStaff(c) {
		return
	}
	var input claimDTO.CreateCustomerClaimItemDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	if err := input.ValidateQuantity(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	res, err := ctrl.svc.CreateCustomerClaimItem(input)
	if err != nil {
		if errors.Is(err, claimRepo.ErrClaimQuantityExceedsOrder) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
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

	if !prepareClaimStatus(c, &input.Status, false) {
		return
	}
	// Approval identity is not client-editable through this general edit route.
	input.ApprovedBy = nil
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
	if err := input.ValidateQuantity(); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if !prepareClaimStatus(c, &input.Status, false) {
		return
	}
	res, err := ctrl.svc.UpdateCustomerClaimItem(uint(id), input)
	if err != nil {
		if errors.Is(err, claimRepo.ErrClaimQuantityExceedsOrder) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, claimSvc.ErrClaimItemAlreadyDelivered) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Updated successfully", "data": res})
}

func (ctrl *CustomerClaimController) UpdateCustomerClaimItemStatus(c *gin.Context) {
	if !isOwnerOrAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the store owner can approve or reject a claim"})
		return
	}

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
	if !prepareClaimStatus(c, &input.Status, false) {
		return
	}
	res, err := ctrl.svc.UpdateCustomerClaimItemStatus(uint(id), input.Status)
	if err != nil {
		if errors.Is(err, claimRepo.ErrClaimQuantityExceedsOrder) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, claimSvc.ErrClaimItemAlreadyDelivered) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update item status: " + err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Status updated successfully", "data": res})
}

func (ctrl *CustomerClaimController) DeleteCustomerClaim(c *gin.Context) {
	if !requireClaimStaff(c) {
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	err = ctrl.svc.DeleteCustomerClaim(uint(id))
	if err != nil {
		if errors.Is(err, claimRepo.ErrClaimAlreadyAdjusted) {
			c.JSON(http.StatusConflict, gin.H{"error": "ไม่สามารถลบใบเคลมนี้ได้ เพราะมีการตัด/เติมสต็อกสินค้าหรือหักหนี้บัญชีเชื่อของลูกค้าไปแล้วจริง"})
			return
		}
		if errors.Is(err, claimRepo.ErrClaimAlreadyCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": "ไม่สามารถลบใบเคลมที่ถูกยกเลิกไปแล้วได้ เนื่องจากต้องเก็บไว้เป็นประวัติ"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete customer claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func (ctrl *CustomerClaimController) CancelCustomerClaim(c *gin.Context) {
	if !isOwnerOrAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the store owner can cancel a customer claim"})
		return
	}
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.CancelCustomerClaim(uint(id))
	if err != nil {
		if errors.Is(err, claimRepo.ErrClaimAlreadyCancelled) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, claimRepo.ErrClaimNotApproved) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel customer claim: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Cancelled successfully", "data": res})
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
