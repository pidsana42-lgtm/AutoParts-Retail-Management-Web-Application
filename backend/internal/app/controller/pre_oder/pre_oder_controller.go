package pre_order

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	preOrderDTO "backend/internal/app/dto/pre_oder"
	svcNotification "backend/internal/app/service/notification"
	preOrderSvc "backend/internal/app/service/pre_oder"
	"github.com/gin-gonic/gin"
)

type PreOrderController struct {
	svc          preOrderSvc.PreOrderService
	notification svcNotification.NotificationService
}

func NewPreOrderController(svc preOrderSvc.PreOrderService, notificationService svcNotification.NotificationService) *PreOrderController {
	return &PreOrderController{svc: svc, notification: notificationService}
}

func (ctrl *PreOrderController) CreatePreOrder(c *gin.Context) {
	var input preOrderDTO.CreatePreOrderDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	if input.CustomerID == 0 && strings.TrimSpace(input.CustomerName) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุชื่อลูกค้า"})
		return
	}

	res, err := ctrl.svc.CreatePreOrder(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pre-order: " + err.Error()})
		return
	}

	// แจ้งเตือนไปยังระบบจัดซื้อ (Purchase / Orders) และเจ้าของร้าน
	msg := fmt.Sprintf("มีรายการพรีออเดอร์ใหม่จากลูกค้า %s จำนวน %d รายการ เข้าสู่ระบบจัดซื้อ", res.CustomerName, len(res.PreOrderItems))
	if res.CustomerName == "" {
		msg = fmt.Sprintf("มีรายการพรีออเดอร์ใหม่ จำนวน %d รายการ เข้าสู่ระบบจัดซื้อ", len(res.PreOrderItems))
	}
	if ctrl.notification != nil {
		if err := ctrl.notification.NotifyOwners("PRE_ORDER_CREATED", "มีรายการพรีออเดอร์ใหม่ (จัดซื้อ)", msg, "/owner/orders", nil); err != nil {
			fmt.Printf("[Notification] failed to notify owners (pre-order %d): %v\n", res.ID, err)
		}
		if err := ctrl.notification.NotifyEmployees("PRE_ORDER_CREATED", "มีรายการพรีออเดอร์ใหม่ (จัดซื้อ)", msg, "/employee/orders", nil); err != nil {
			fmt.Printf("[Notification] failed to notify employees (pre-order %d): %v\n", res.ID, err)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *PreOrderController) CreatePreOrderItem(c *gin.Context) {
	var input preOrderDTO.CreatePreOrderItemDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	if input.PreOrderID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุพรีออเดอร์สำหรับรายการสินค้า"})
		return
	}

	res, err := ctrl.svc.CreatePreOrderItem(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create pre-order item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *PreOrderController) GetPreOrderByID(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.GetPreOrderByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Pre-order not found: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *PreOrderController) ListPreOrders(c *gin.Context) {
	res, err := ctrl.svc.ListPreOrders()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve pre-orders: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *PreOrderController) UpdatePreOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input preOrderDTO.UpdatePreOrderDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	if input.CustomerID != nil && *input.CustomerID == 0 &&
		(input.CustomerName == nil || strings.TrimSpace(*input.CustomerName) == "") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุชื่อลูกค้า"})
		return
	}

	res, err := ctrl.svc.UpdatePreOrder(uint(id), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update pre-order: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Updated successfully",
		"data":    res,
	})
}

func (ctrl *PreOrderController) DeletePreOrder(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	err = ctrl.svc.DeletePreOrder(uint(id))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete pre-order: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Deleted successfully"})
}

func (ctrl *PreOrderController) ListPreOrdersForPOSelection(c *gin.Context) {
	res, err := ctrl.svc.ListPreOrdersForPOSelection(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve pre-orders: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}
