package oa

type LineWebhookSource struct {
	Type   string `json:"type"`
	UserID string `json:"userId"`
}

type LineWebhookMessage struct {
	ID   string `json:"id"`
	Type string `json:"type"`
	Text string `json:"text"`
}

type LineWebhookEvent struct {
	ReplyToken     string              `json:"replyToken"`
	Type           string              `json:"type"`
	Mode           string              `json:"mode"`
	Timestamp      int64               `json:"timestamp"`
	Source         LineWebhookSource   `json:"source"`
	WebhookEventID string              `json:"webhookEventId"`
	Message        *LineWebhookMessage `json:"message,omitempty"`
}

type LineWebhookRequest struct {
	Destination string             `json:"destination"`
	Events      []LineWebhookEvent `json:"events"`
}

// Frontend communication DTOs

type LineUserDTO struct {
	ID            uint   `json:"id"`
	LineUserID    string `json:"line_user_id"`
	DisplayName   string `json:"display_name"`
	PictureURL    string `json:"picture_url"`
	StatusMessage string `json:"status_message"`
	CustomerID    *uint  `json:"customer_id"`
	CustomerName  string `json:"customer_name"`
	UnreadCount   int    `json:"unread_count"`
}

type LineMessageDTO struct {
	ID             uint   `json:"id"`
	LineUserID     string `json:"line_user_id"`
	Sender         string `json:"sender"` // "user" or "admin"
	MessageType    string `json:"message_type"`
	MessageContent string `json:"message_content"`
	CreatedAt      string `json:"created_at"`
	IsRead         bool   `json:"is_read"`
}

type SendMessageRequest struct {
	LineUserID string `json:"line_user_id" binding:"required"`
	Text       string `json:"text" binding:"required"`
}

type LinkCustomerRequest struct {
	CustomerID uint `json:"customer_id" binding:"required"`
}
