package oa

import (
	"net/http"
	"strconv"
	"time"

	dto "backend/internal/app/dto/oa"
	service "backend/internal/app/service/oa"
	"github.com/gin-gonic/gin"
)

type Controller struct {
	service service.Service
}

func NewController(service service.Service) *Controller {
	return &Controller{service: service}
}

func (ctrl *Controller) Webhook(c *gin.Context) {
	var req dto.LineWebhookRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid webhook payload: " + err.Error()})
		return
	}

	if err := ctrl.service.HandleWebhook(req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Webhook processed successfully"})
}

func (ctrl *Controller) GetLineUsers(c *gin.Context) {
	users, err := ctrl.service.GetLineUsers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, users)
}

func (ctrl *Controller) GetLineMessages(c *gin.Context) {
	lineUserID := c.Param("line_user_id")
	if lineUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "line_user_id is required"})
		return
	}

	messages, err := ctrl.service.GetLineMessages(lineUserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, messages)
}

func (ctrl *Controller) SendMessage(c *gin.Context) {
	var req dto.SendMessageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.SendMessage(req.LineUserID, req.Text); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Message sent successfully"})
}

func (ctrl *Controller) LinkCustomer(c *gin.Context) {
	lineUserID := c.Param("line_user_id")
	if lineUserID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "line_user_id is required"})
		return
	}

	var req dto.LinkCustomerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := ctrl.service.LinkCustomer(lineUserID, req.CustomerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Linked customer successfully"})
}

// Dev Simulation Endpoint:
// Allows developer to trigger simulated incoming LINE messages from the browser console to test UI components!
func (ctrl *Controller) SimulateUserWebhook(c *gin.Context) {
	var body struct {
		LineUserID  string `json:"line_user_id"`
		DisplayName string `json:"display_name"`
		Text        string `json:"text"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if body.LineUserID == "" {
		body.LineUserID = "U" + strconv.FormatInt(time.Now().UnixNano(), 10)[:16]
	}
	if body.DisplayName == "" {
		body.DisplayName = "ลูกค้าจำลอง (Simulated)"
	}
	if body.Text == "" {
		body.Text = "สวัสดีครับ สนใจสอบถามอะไหล่ครับ"
	}

	// Craft a simulated LineWebhookRequest
	simulatedReq := dto.LineWebhookRequest{
		Destination: "simulated_destination",
		Events: []dto.LineWebhookEvent{
			{
				ReplyToken: "simulated_reply_token",
				Type:       "message",
				Mode:       "active",
				Timestamp:  time.Now().UnixNano() / int64(time.Millisecond),
				Source: dto.LineWebhookSource{
					Type:   "user",
					UserID: body.LineUserID,
				},
				WebhookEventID: "simulated_event_id",
				Message: &dto.LineWebhookMessage{
					ID:   "simulated_msg_id_" + strconv.FormatInt(time.Now().Unix(), 10),
					Type: "text",
					Text: body.Text,
				},
			},
		},
	}

	// Run HandleWebhook
	if err := ctrl.service.HandleWebhook(simulatedReq); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Return updated user list or success status
	c.JSON(http.StatusOK, gin.H{
		"message":      "Simulated message sent successfully",
		"line_user_id": body.LineUserID,
		"display_name": body.DisplayName,
	})
}
