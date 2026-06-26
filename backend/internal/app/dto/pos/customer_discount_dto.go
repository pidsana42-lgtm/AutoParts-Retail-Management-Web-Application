package pos

import "backend/internal/app/entity"

type GetCustomerDiscountResponse struct {
	CustomerID           uint    `json:"customer_id"`
	CustomerName         string  `json:"customer_name"`
	StandardDiscountRate float64 `json:"standard_discount_rate"`
	IsDiscountEnabled    bool    `json:"is_discount_enabled"`
	CurrentDebtAmount    float64 `json:"current_debt_amount"`
}

func ToCustomerDiscountResponse(customer *entity.Customer) *GetCustomerDiscountResponse {
	return &GetCustomerDiscountResponse{
		CustomerID:           customer.ID,
		CustomerName:         customer.CustomerName, 
		StandardDiscountRate: customer.StandardDiscountRate,
		IsDiscountEnabled:    customer.IsDiscountEnabled,
		CurrentDebtAmount:    customer.CurrentDebtAmount,
	}
}

type UpdateCustomerDiscountItemRequest struct {
	ID                   uint    `json:"id" binding:"required"`
	StandardDiscountRate float64 `json:"standard_discount_rate"`
	IsDiscountEnabled    bool    `json:"is_discount_enabled"`
}

type BulkUpdateCustomerDiscountRequest struct {
	DiscountItems []UpdateCustomerDiscountItemRequest `json:"discount_items" binding:"required,dive"`
}
