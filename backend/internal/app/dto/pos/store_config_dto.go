package pos

import "backend/internal/app/entity"

type StoreConfigResponse struct {
	MaxCredit            float64 `json:"max_credit"`
	MaxOverdueDays       int     `json:"max_overdue_days"`
	MaxItemDiscountRate  float64 `json:"max_item_discount_rate"`
	MaxExtraDiscountRate float64 `json:"max_extra_discount_rate" `
	SupervisedPin        string  `json:"supervised_pin"`
}

func ToStoreConfigResponse(config *entity.StoreConfig) *StoreConfigResponse {
	return &StoreConfigResponse{
		MaxCredit:            config.MaxCredit,
		MaxOverdueDays:       config.MaxOverdueDays,
		MaxItemDiscountRate:  config.MaxItemDiscountRate,
		MaxExtraDiscountRate: config.MaxExtraDiscountRate,
		SupervisedPin:        config.SupervisedPin,
	}
}

type StoreConfigRequest struct {
	MaxCredit            float64 `json:"max_credit"`
	MaxOverdueDays       int     `json:"max_overdue_days"`
	MaxItemDiscountRate  float64 `json:"max_item_discount_rate"`
	MaxExtraDiscountRate float64 `json:"max_extra_discount_rate" `
	SupervisedPin        string  `json:"supervised_pin"`
}

func ToStoreConfigRequest(config entity.StoreConfig) StoreConfigRequest {
	return StoreConfigRequest{
		MaxCredit:            config.MaxCredit,
		MaxOverdueDays:       config.MaxOverdueDays,
		MaxItemDiscountRate:  config.MaxItemDiscountRate,
		MaxExtraDiscountRate: config.MaxExtraDiscountRate,
		SupervisedPin:        config.SupervisedPin,
	}
}