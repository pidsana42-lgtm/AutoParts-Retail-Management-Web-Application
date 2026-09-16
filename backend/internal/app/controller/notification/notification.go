package notification

import (
	"net/http"
	"strconv"
	"strings"

	svcNotification "backend/internal/app/service/notification"

	"github.com/gin-gonic/gin"
)

type NotificationController struct {
	service svcNotification.NotificationService
}

func NewNotificationController(service svcNotification.NotificationService) *NotificationController {
	return &NotificationController{service: service}
}

// เจ้าของร้าน/Manager ดูของทั้งร้าน (ForOwners) ส่วนพนักงานดูเฉพาะของตัวเอง (TargetUserID)
// ?role=Owner|Manager|Admin|Employee|Staff&user_id=<id ของพนักงาน กรณี role เป็นพนักงาน>
func (ctrl *NotificationController) List(c *gin.Context) {
	role := strings.ToUpper(c.Query("role"))
	isOwnerOrManager := role == "OWNER" || role == "MANAGER" || role == "ADMIN"

	if isOwnerOrManager {
		res, err := ctrl.service.ListForOwners()
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, res)
		return
	}

	userID, err := strconv.ParseUint(c.Query("user_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุ user_id"})
		return
	}
	res, err := ctrl.service.ListForUser(uint(userID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, res)
}

func (ctrl *NotificationController) MarkRead(c *gin.Context) {
	var uri struct {
		ID uint `uri:"id" binding:"required"`
	}
	if err := c.ShouldBindUri(&uri); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid ID format"})
		return
	}
	if err := ctrl.service.MarkRead(uri.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked as read"})
}

// ?role=Owner|Manager|Admin|Employee|Staff&user_id=<id ของพนักงาน กรณี role เป็นพนักงาน>
func (ctrl *NotificationController) MarkAllRead(c *gin.Context) {
	role := strings.ToUpper(c.Query("role"))
	isOwnerOrManager := role == "OWNER" || role == "MANAGER" || role == "ADMIN"

	if isOwnerOrManager {
		if err := ctrl.service.MarkAllReadForOwners(); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "marked all as read"})
		return
	}

	userID, err := strconv.ParseUint(c.Query("user_id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุ user_id"})
		return
	}
	if err := ctrl.service.MarkAllReadForUser(uint(userID)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "marked all as read"})
}
