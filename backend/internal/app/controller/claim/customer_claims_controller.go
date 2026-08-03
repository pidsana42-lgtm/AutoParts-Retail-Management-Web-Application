package claim

import (
	"net/http"
	"strconv"

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

	res, err := ctrl.svc.CreateCustomerClaim(input)
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
