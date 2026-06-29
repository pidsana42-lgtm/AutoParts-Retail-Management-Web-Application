package entity

import (
	"gorm.io/gorm"
	"time"
)

type CheckStockSchedule struct {
	gorm.Model
	Scheduled_DateTime time.Time    `json:"scheduled_datetime"`
	Status             string       `json:"status"` // "pending" | "completed"
	Note               string       `json:"note"`
	CheckStocks        []CheckStock `gorm:"foreignKey:CheckStockScheduleID" json:"check_stocks"`
}
