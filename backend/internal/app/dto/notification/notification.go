package notification

import "time"

type NotificationResponseDTO struct {
	ID                   uint      `json:"id"`
	Type                 string    `json:"type"`
	Title                string    `json:"title"`
	Message              string    `json:"message"`
	Link                 string    `json:"link"`
	IsRead               bool      `json:"is_read"`
	CheckStockScheduleID *uint     `json:"check_stock_schedule_id"`
	CreatedAt            time.Time `json:"created_at"`
}

type NotificationListResponseDTO struct {
	Notifications []NotificationResponseDTO `json:"notifications"`
	UnreadCount   int64                     `json:"unread_count"`
}
