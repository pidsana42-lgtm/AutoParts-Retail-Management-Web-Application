package wms

import "time"

type CheckStockScheduleRequestDTO struct {
	Scheduled_DateTime time.Time `json:"scheduled_datetime" binding:"required"`
	Note               string    `json:"note"`
}

type CheckStockScheduleResponseDTO struct {
	ID                 uint      `json:"id"`
	Scheduled_DateTime time.Time `json:"scheduled_datetime"`
	Status             string    `json:"status"`
	Note               string    `json:"note"`
	CreatedAt          time.Time `json:"created_at"`
}
