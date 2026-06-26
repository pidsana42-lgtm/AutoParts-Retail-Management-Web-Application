package customer

import "backend/internal/app/entity"

type RegisterCustomerRequest struct {
	CustomerName         string `json:"customer_name" binding:"required"`
	CustomerTypeID       uint   `json:"customer_type_id" binding:"required"`
	PhoneNumber          string `json:"phone_number" binding:"required"`
	IdCardNumberCustomer string `json:"id_card_number_customer" binding:"required"`
	RegisteredAddress    string `json:"registered_address" binding:"required"`
	ShippingAddress      string `json:"shipping_address" binding:"required"`
}

// idCardImagePath ตอนrequestมันมาเป็นภาพไฟล์ดิบ
func ToCustomerEntity(req RegisterCustomerRequest, idCardImagePath string, defaultCreditLimit float64) *entity.Customer {
	return &entity.Customer{
		CustomerName:         req.CustomerName,
		CustomerTypeID:       req.CustomerTypeID,
		CreditLimit:          defaultCreditLimit, //ใช้ค่าจากนโยบายร้านที่ Service ส่งมาให้
		PhoneNumber:          req.PhoneNumber,
		IdCardNumberCustomer: req.IdCardNumberCustomer,
		IdCardImagePath:      idCardImagePath, //รับพาร์ทข้อความ String ไปบันทึกป้ายบอกทาง
		RegisteredAddress:    req.RegisteredAddress,
		ShippingAddress:      req.ShippingAddress,

		// ค่าสถานะเริ่มต้นที่หลังบ้านปั๊มให้เองอัตโนมัติ
		CurrentBalance:       0.00,
		StandardDiscountRate: 0.00,
		CurrentDebtAmount:    0.00,
		IsDiscountEnabled:    true,
	}
}

type CustomerResponse struct {
	ID                   uint   `json:"id"`
	CustomerName         string `json:"customer_name"`
	PhoneNumber          string `json:"phone_number"`
	IdCardNumberCustomer string `json:"id_card_number_customer"`
	DisplayAddress       string `json:"display_address"`     // ทำฟิลด์สรุปที่อยู่ส่งไปให้หน้าบ้านใช้ง่ายๆ
	CustomerTypeLabel    string `json:"customer_type_label"` // เอาชื่อภาษาไทย เช่น "ลูกค้าอู่" ตรงๆ เลย
}

func ToCustomerListResponse(customers []entity.Customer) []CustomerResponse {
	var list []CustomerResponse

	for _, c := range customers {
		// สรุปที่อยู่
		address := c.ShippingAddress
		if address == "" {
			address = c.RegisteredAddress
		}

		list = append(list, CustomerResponse{
			ID:                   c.ID,
			CustomerName:         c.CustomerName,
			PhoneNumber:          c.PhoneNumber,
			IdCardNumberCustomer: c.IdCardNumberCustomer,
			DisplayAddress:       address,
			CustomerTypeLabel:    c.CustomerType.TypeLabel, // ดึงชื่อภาษาไทยมาจากตารางประเภทลูกค้าที่เรา Preload ไว้
		})
	}

	return list
}

type CustomerDetailResponse struct {
	ID                   uint    `json:"id"`
	CustomerName         string  `json:"customer_name"`
	CustomerTypeID       uint    `json:"customer_type_id"`
	CustomerTypeLabel    string  `json:"customer_type_label"`
	CreditLimit          float64 `json:"credit_limit"`
	PhoneNumber          string  `json:"phone_number"`
	IdCardNumberCustomer string  `json:"id_card_number_customer"`
	IdCardImagePath      string  `json:"id_card_image_path"`
	RegisteredAddress    string  `json:"registered_address"`
	ShippingAddress      string  `json:"shipping_address"`
	CurrentBalance       float64 `json:"current_balance"`
	StandardDiscountRate float64 `json:"standard_discount_rate"`
	CurrentDebtAmount    float64 `json:"current_debt_amount"`
	IsDiscountEnabled    bool    `json:"is_discount_enabled"`
}

func ToCustomerDetailResponse(c entity.Customer) CustomerDetailResponse {
    return CustomerDetailResponse{
        ID:                   c.ID,
        CustomerName:         c.CustomerName,
        CustomerTypeID:       c.CustomerTypeID,
        CustomerTypeLabel:    c.CustomerType.TypeLabel, // ดึงชื่อภาษาไทยออกมาโชว์
        CreditLimit:          c.CreditLimit,
        PhoneNumber:          c.PhoneNumber,
        IdCardNumberCustomer: c.IdCardNumberCustomer,
        IdCardImagePath:      c.IdCardImagePath,
        RegisteredAddress:    c.RegisteredAddress,
        ShippingAddress:      c.ShippingAddress,
        CurrentBalance:       c.CurrentBalance,
        StandardDiscountRate: c.StandardDiscountRate,
        CurrentDebtAmount:    c.CurrentDebtAmount,
        IsDiscountEnabled:    c.IsDiscountEnabled,
    }
}