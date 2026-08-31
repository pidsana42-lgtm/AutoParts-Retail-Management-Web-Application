package returns

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	reDto "backend/internal/app/dto/return"
	reRepo "backend/internal/app/repository/return"
	reSvc "backend/internal/app/service/return"
	"github.com/gin-gonic/gin"
)

type ReturnController struct {
	service reSvc.ReturnService
}

func NewReturnController(service reSvc.ReturnService) *ReturnController {
	return &ReturnController{service: service}
}

func getUserIDFromContext(c *gin.Context) uint {
	var uid uint = 1
	if val, exists := c.Get("user_id"); exists {
		switch v := val.(type) {
		case float64:
			uid = uint(v)
		case uint:
			uid = v
		case int:
			uid = uint(v)
		case int64:
			uid = uint(v)
		}
	}
	return uid
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

func (ctl *ReturnController) GetReturns(c *gin.Context) {
	var req reDto.GetReturnsRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := ctl.service.GetReturns(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}

func (ctl *ReturnController) SearchReturnableSaleOrders(c *gin.Context) {
	keyword := c.Query("search")
	if keyword == "" {
		keyword = c.Query("q")
	}

	res, err := ctl.service.SearchReturnableSaleOrders(keyword)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to search sale orders: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctl *ReturnController) GetReturnByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctl.service.GetReturnByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Return record not found: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctl *ReturnController) CreateSalesReturn(c *gin.Context) {
	var input reDto.CreateReturnDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	createdBy := getUserIDFromContext(c)
	res, err := ctl.service.CreateReturn(input, createdBy, getRoleFromContext(c))
	if err != nil {
		if errors.Is(err, reRepo.ErrOrderInProgress) {
			c.JSON(http.StatusConflict, gin.H{"error": "sale order is already being claimed or returned"})
			return
		}
		if errors.Is(err, reRepo.ErrOrderNotCompleted) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "only completed sale orders can be returned"})
			return
		}
		if errors.Is(err, reRepo.ErrReturnQuantityExceedsOrder) || errors.Is(err, reRepo.ErrRefundAmountExceedsOrder) || errors.Is(err, reRepo.ErrInvalidRefundMethod) || errors.Is(err, reRepo.ErrRefundRequiresCustomer) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create return: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctl *ReturnController) UpdateSalesReturn(c *gin.Context) {
	if !isOwnerOrAdmin(c) {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the store owner can approve or reject a return"})
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input reDto.UpdateReturnDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	approvedBy := getUserIDFromContext(c)
	res, err := ctl.service.UpdateReturn(uint(id), input, approvedBy)
	if err != nil {
		if errors.Is(err, reSvc.ErrInvalidReturnStatus) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, reRepo.ErrReturnAlreadyProcessed) || errors.Is(err, reRepo.ErrReturnNotPending) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, reRepo.ErrOrderNotCompleted) || errors.Is(err, reRepo.ErrReturnQuantityExceedsOrder) || errors.Is(err, reRepo.ErrRefundAmountExceedsOrder) || errors.Is(err, reRepo.ErrInvalidRefundMethod) || errors.Is(err, reRepo.ErrRefundRequiresCustomer) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update return: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Updated successfully",
		"data":    res,
	})
}

func (ctl *ReturnController) ProcessRefund(c *gin.Context) {
	role := getRoleFromContext(c)
	if role != "OWNER" && role != "EMPLOYEE" && role != "ADMIN" {
		c.JSON(http.StatusForbidden, gin.H{"error": "only the store owner or employee can process a refund"})
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctl.service.ProcessRefund(uint(id), getUserIDFromContext(c))
	if err != nil {
		if errors.Is(err, reRepo.ErrReturnNotApproved) || errors.Is(err, reRepo.ErrReturnAlreadyProcessed) {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, reRepo.ErrInvalidRefundMethod) || errors.Is(err, reRepo.ErrRefundRequiresCustomer) || errors.Is(err, reRepo.ErrRefundAmountExceedsOrder) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process refund: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Refund processed successfully",
		"data":    res,
	})
}

func (ctl *ReturnController) DeleteSalesReturn(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	if err := ctl.service.DeleteReturn(uint(id)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete return: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}
