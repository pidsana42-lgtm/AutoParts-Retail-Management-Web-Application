package customer

import "backend/internal/app/entity"

type RegisterCustomerRequest struct {
	CustomerName         string `json:"customer_name" binding:"required"`
	CustomerType         string `json:"customer_type" binding:"required"`
	PhoneNumber          string `json:"phone_number" binding:"required"`
	IdCardNumberCustomer string `json:"id_card_number_customer" binding:"required"`
	RegisteredAddress    string `json:"registered_address" binding:"required"`
	ShippingAddress      string `json:"shipping_address" binding:"required"`
}

// idCardImagePath ตอนrequestมันมาเป็นภาพไฟล์ดิบ
func ToCustomerEntity(req RegisterCustomerRequest, idCardImagePath string, defaultCreditLimit float64) *entity.Customer {
	return &entity.Customer{
		CustomerName:         req.CustomerName,
		CustomerType:         req.CustomerType,
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
