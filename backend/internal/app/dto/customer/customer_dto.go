package customer

import (
	"time"
	"backend/internal/app/entity"
)

type RegisterCustomerRequest struct {
	CustomerName         string `json:"customer_name" form:"customer_name" binding:"required"`
	CustomerTypeID       uint   `json:"customer_type_id" form:"customer_type_id" binding:"required"`
	PhoneNumber          string `json:"phone_number" form:"phone_number" binding:"required"`
	IdCardNumberCustomer string `json:"id_card_number_customer" form:"id_card_number_customer" binding:"required"`
	RegisteredAddress    string `json:"registered_address" form:"registered_address" binding:"required"`
	ShippingAddress      string `json:"shipping_address" form:"shipping_address" binding:"required"`
	IdCardImagePath      string `json:"id_card_image_path" form:"id_card_image_path"`
}

type UpdateCustomerRequest struct {
	CustomerName         string   `json:"customer_name" form:"customer_name" binding:"required"`
	CustomerTypeID       uint     `json:"customer_type_id" form:"customer_type_id" binding:"required"`
	PhoneNumber          string   `json:"phone_number" form:"phone_number" binding:"required"`
	IdCardNumberCustomer string   `json:"id_card_number_customer" form:"id_card_number_customer" binding:"required"`
	RegisteredAddress    string   `json:"registered_address" form:"registered_address" binding:"required"`
	ShippingAddress      string   `json:"shipping_address" form:"shipping_address" binding:"required"`
	IdCardImagePath      string   `json:"id_card_image_path" form:"id_card_image_path"`
	CreditLimit          *float64 `json:"credit_limit,omitempty" form:"credit_limit"`
	StandardDiscountRate *float64 `json:"standard_discount_rate,omitempty" form:"standard_discount_rate"`
	IsDiscountEnabled    *bool    `json:"is_discount_enabled,omitempty" form:"is_discount_enabled"`
	OntopDiscountRate    *float64 `json:"ontop_discount_rate,omitempty" form:"ontop_discount_rate"`
}

// idCardImagePath ตอนrequestมันมาเป็นภาพไฟล์ดิบ
func ToCustomerEntity(req RegisterCustomerRequest, idCardImagePath string, defaultCreditLimit float64) *entity.Customer {
	if idCardImagePath == "" && req.IdCardImagePath != "" {
		idCardImagePath = req.IdCardImagePath
	}
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

		// ฟิลด์ใหม่ที่เพิ่มเข้ามาใน Entity (ใส่ไว้เป็นค่าเริ่มต้น หรือรอให้ Service เขียนทับ)
		IsDiscountEnabled: false, // ให้ Service เป็นคนสั่งเปิดถ้าเป็นอู่
		OntopDiscountRate: 0.00,  // ให้แอดมินไปปรับเพิ่มให้ตามเกรดอู่หน้าระบบทีหลัง
	}
}

type CustomerResponse struct {
	ID                   uint   `json:"id"`
	CustomerName         string `json:"customer_name"`
	PhoneNumber          string `json:"phone_number"`
	IdCardNumberCustomer string `json:"id_card_number_customer"`
	IdCardImagePath      string `json:"id_card_image_path"`
	DisplayAddress       string `json:"display_address"`
	CustomerTypeLabel    string `json:"customer_type_label"` // ค้างไว้เพื่อให้ระบบเดิมทำงานได้

	CurrentDebtAmount    float64              `json:"current_debt_amount"`
	MaxCreditLimit       float64              `json:"max_credit_limit"` // ดึงมาจาก CreditLimit ในคลัง
	IsDiscountEnabled    bool                 `json:"is_discount_enabled"`
	StandardDiscountRate float64              `json:"standard_discount_rate"`
	OntopDiscountRate    float64              `json:"ontop_discount_rate"` // เพิ่มบรรทัดนี้เพื่อแมปข้อมูลออกไป
	CustomerType         CustomerTypeResponse `json:"customer_type"`       // สลักฝังข้อมูลออบเจกต์ข้ามตาราง
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
			IdCardImagePath:      c.IdCardImagePath,
			DisplayAddress:       address,
			CustomerTypeLabel:    c.CustomerType.TypeLabel, // ดึงชื่อภาษาไทยมาจากตารางประเภทลูกค้าที่เรา Preload ไว้
			CurrentDebtAmount:    c.CurrentDebtAmount,
			MaxCreditLimit:       c.CreditLimit,
			IsDiscountEnabled:    c.IsDiscountEnabled,
			StandardDiscountRate: c.StandardDiscountRate,
			OntopDiscountRate:    c.OntopDiscountRate, // เพิ่มบรรทัดนี้เพื่อแมปข้อมูลออกไป
			CustomerType: CustomerTypeResponse{
				ID:        c.CustomerType.ID,
				TypeName:  c.CustomerType.TypeName,
				TypeLabel: c.CustomerType.TypeLabel,
			},
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
	OntopDiscountRate    float64 `json:"ontop_discount_rate"` // เพิ่มบรรทัดนี้เพื่อแมปข้อมูลออกไป
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
		OntopDiscountRate:    c.OntopDiscountRate, // เพิ่มบรรทัดนี้เพื่อแมปข้อมูลออกไป
	}
}

type CustomerTypeResponse struct {
	ID        uint   `json:"id"`
	TypeName  string `json:"type_name"`  // เช่น GENERAL, GARAGE, WHOLESALE
	TypeLabel string `json:"type_label"` // เช่น ลูกค้าทั่วไป, ลูกค้าอู่ซ่อมรถ
}

func ToCustomerTypeListResponse(customerTypes []entity.CustomerType) []CustomerTypeResponse {
	var list []CustomerTypeResponse

	for _, ct := range customerTypes {
		list = append(list, CustomerTypeResponse{
			ID:        ct.ID,
			TypeName:  ct.TypeName,
			TypeLabel: ct.TypeLabel,
		})
	}

	return list
}

type UpdateCustomerDiscountRequest struct {
	IsDiscountEnabled    bool     `json:"is_discount_enabled"`
	OntopDiscountRate    float64  `json:"ontop_discount_rate" binding:"min=0"`
	CreditLimit          *float64 `json:"credit_limit,omitempty"`
	StandardDiscountRate *float64 `json:"standard_discount_rate,omitempty"`
}

type CustomerCreditAuditLogResponse struct {
	ID           uint      `json:"id"`
	CustomerID   *uint     `json:"customer_id,omitempty"`
	CustomerName string    `json:"customer_name"`
	Action       string    `json:"action"`
	Details      string    `json:"details"`
	ChangedBy    string    `json:"changed_by"`
	ChangedAt    time.Time `json:"changed_at"`
}

func ToCustomerCreditAuditLogResponse(log *entity.CustomerCreditAuditLog) *CustomerCreditAuditLogResponse {
	return &CustomerCreditAuditLogResponse{
		ID:           log.ID,
		CustomerID:   log.CustomerID,
		CustomerName: log.CustomerName,
		Action:       log.Action,
		Details:      log.Details,
		ChangedBy:    log.ChangedBy,
		ChangedAt:    log.CreatedAt,
	}
}

type CreateCustomerCreditAuditLogRequest struct {
	CustomerID   *uint  `json:"customer_id"`
	CustomerName string `json:"customer_name" binding:"required"`
	Action       string `json:"action" binding:"required"`
	Details      string `json:"details" binding:"required"`
}
