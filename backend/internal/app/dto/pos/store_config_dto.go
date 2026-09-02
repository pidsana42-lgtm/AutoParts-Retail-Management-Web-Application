package pos

import (
	"time"
	"backend/internal/app/entity"
)

type StoreConfigResponse struct {
	MaxCredit            float64 `json:"max_credit"`
	MaxOverdueDays       int     `json:"max_overdue_days"`
	//MaxItemDiscountRate  float64 `json:"max_item_discount_rate"`
	MaxExtraDiscountRate float64 `json:"max_extra_discount_rate" `
	SupervisedPin        string  `json:"supervised_pin"`
}

func ToStoreConfigResponse(config *entity.StoreConfig) *StoreConfigResponse {
	return &StoreConfigResponse{
		MaxCredit:            config.MaxCredit,
		MaxOverdueDays:       config.MaxOverdueDays,
		//MaxItemDiscountRate:  config.MaxItemDiscountRate,
		MaxExtraDiscountRate: config.MaxExtraDiscountRate,
		SupervisedPin:        config.SupervisedPin,
	}
}

type StoreConfigRequest struct {
	MaxCredit            float64 `json:"max_credit"`
	MaxOverdueDays       int     `json:"max_overdue_days"`
	//MaxItemDiscountRate  float64 `json:"max_item_discount_rate"`
	MaxExtraDiscountRate float64 `json:"max_extra_discount_rate" `
	SupervisedPin        string  `json:"supervised_pin"`
}

type StoreConfigAuditLogResponse struct {
	ID        uint      `json:"id"`
	Action    string    `json:"action"`
	Details   string    `json:"details"`
	ChangedBy string    `json:"changed_by"`
	ChangedAt time.Time `json:"changed_at"`
}

func ToStoreConfigAuditLogResponse(log *entity.StoreConfigAuditLog) *StoreConfigAuditLogResponse {
	return &StoreConfigAuditLogResponse{
		ID:        log.ID,
		Action:    log.Action,
		Details:   log.Details,
		ChangedBy: log.ChangedBy,
		ChangedAt: log.CreatedAt,
	}
}