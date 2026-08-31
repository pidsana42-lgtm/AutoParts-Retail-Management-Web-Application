package pos

import "backend/internal/app/entity"

type CustomerTypeInfoResponse struct {
    ID        uint   `json:"id"`
    TypeName  string `json:"type_name"`
    TypeLabel string `json:"type_label"`
}

type GetCustomerDiscountResponse struct {
    ID                   uint                     `json:"id"` // เพื่อให้ React .id ได้ตรงๆ
    CustomerID           uint                     `json:"customer_id"`
    CustomerName         string                   `json:"customer_name"`
    PhoneNumber          string                   `json:"phone_number"`
    IdCardNumberCustomer string                   `json:"id_card_number_customer"`
    MaxCreditLimit       float64                  `json:"max_credit_limit"`
    CurrentDebtAmount    float64                  `json:"current_debt_amount"`
    IsDiscountEnabled    bool                     `json:"is_discount_enabled"`
    StandardDiscountRate float64                  `json:"standard_discount_rate"`
    OntopDiscountRate    float64                  `json:"ontop_discount_rate"`
    CustomerType         CustomerTypeInfoResponse `json:"customer_type"` // ผูก Object ประเภทเข้าท่อส่งออก
    ShippingAddress      string                   `json:"shipping_address"`
    RegisteredAddress    string                   `json:"registered_address"`
}

func ToCustomerDiscountResponse(customer *entity.Customer) *GetCustomerDiscountResponse {
    // ตั้งค่าเริ่มต้น (Fallback) เผื่อไว้ก่อน
    var typeID uint = 1
    var name string = "GENERAL"
    var label string = "ลูกค้าทั่วไป"
    
    if customer.CustomerType.ID != 0 {
        typeID = customer.CustomerType.ID
        name = customer.CustomerType.TypeName
        label = customer.CustomerType.TypeLabel
    }

    return &GetCustomerDiscountResponse{
        ID:                   customer.ID,
        CustomerID:           customer.ID,
        CustomerName:         customer.CustomerName, 
        PhoneNumber:          customer.PhoneNumber,
        IdCardNumberCustomer: customer.IdCardNumberCustomer,
        MaxCreditLimit:       customer.CreditLimit, 
        CurrentDebtAmount:    customer.CurrentDebtAmount,
        IsDiscountEnabled:    customer.IsDiscountEnabled,
        StandardDiscountRate: customer.StandardDiscountRate,
        OntopDiscountRate:    customer.OntopDiscountRate,
        CustomerType: CustomerTypeInfoResponse{
            ID:        typeID,
            TypeName:  name,
            TypeLabel: label,
        },
        ShippingAddress:      customer.ShippingAddress,
        RegisteredAddress:    customer.RegisteredAddress,
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
