package customer

import (
	customerRepo "backend/internal/app/repository/customer"
	customerDto "backend/internal/app/dto/customer"
	"gorm.io/gorm"
	"backend/internal/app/entity"
	"backend/internal/pkg/crypto"
	"errors"
	"fmt"
	"strings"
)

type CustomerService interface {
	RegisterNewCustomer(customer customerDto.RegisterCustomerRequest, idCardImagePath string) error
	GetAllCustomers() ([]customerDto.CustomerResponse, error)
	GetCustomerByID(id uint) (customerDto.CustomerDetailResponse, error) 
	UpdateCustomer(id uint, req customerDto.UpdateCustomerRequest, userID uint) error
	UpdateCustomerDiscount(id uint, req customerDto.UpdateCustomerDiscountRequest, userID uint) error
	CreateCreditAuditLog(req customerDto.CreateCustomerCreditAuditLogRequest, userID uint) error
	GetCreditAuditLogs() ([]customerDto.CustomerCreditAuditLogResponse, error)
}

type customerService struct {
	repo customerRepo.CustomerRepository
	db *gorm.DB
}

func NewCustomerService(repo customerRepo.CustomerRepository, db *gorm.DB) CustomerService {
	return &customerService{repo: repo, db: db}
}

func (s *customerService) RegisterNewCustomer(req customerDto.RegisterCustomerRequest, idCardImagePath string) error {
	if idCardImagePath == "" && req.IdCardImagePath != "" {
		idCardImagePath = req.IdCardImagePath
	}

	encIdCard, _ := crypto.EncryptAES256(req.IdCardNumberCustomer)
	var countIdCard int64
	s.db.Model(&entity.Customer{}).Where("id_card_number_customer = ? OR id_card_number_customer = ?", encIdCard, req.IdCardNumberCustomer).Count(&countIdCard)
	if countIdCard > 0 { // ถ้ามีมากกว่า 0 แสดงว่าซ้ำ
		return errors.New("เลขบัตรประชาชนนี้เคยลงทะเบียนในระบบ")
	}

	var countPhone int64
	s.db.Model(&entity.Customer{}).Where("phone_number = ?", req.PhoneNumber).Count(&countPhone)
	if countPhone > 0 { 
		return errors.New("หมายเลขโทรศัพท์นี้เคยลงทะเบียนในระบบ")
	}
	var customerType entity.CustomerType
	err := s.db.First(&customerType, req.CustomerTypeID).Error
	if err != nil {
		return errors.New("ประเภทลูกค้าที่เลือกไม่ถูกต้อง")
	}
	// กำหนดค่าเริ่มต้นของ CreditLimit ตามนโยบายร้านค้า (ถ้ายังไม่ได้ตั้งค่า ให้เป็น 0.00 ไม่ใช่ 50,000)
	var defaultCreditFromConfig float64 = 0.00
	var storeConfig entity.StoreConfig
	if err := s.db.First(&storeConfig).Error; err == nil {
		defaultCreditFromConfig = storeConfig.MaxCredit
	}

	// ถ้ามีการระบุวงเงินเครดิตมาใน request ให้ใช้ค่านั้น
	// แต่ถ้าไม่ได้ระบุ และไม่ใช่กลุ่มอู่ซ่อมรถ (GARAGE) วงเงินเริ่มต้นต้องเป็น 0.00
	if req.CreditLimit != nil && *req.CreditLimit >= 0 {
		defaultCreditFromConfig = *req.CreditLimit
	} else if customerType.TypeName != "GARAGE" {
		defaultCreditFromConfig = 0.00
	}

	newCustomer := customerDto.ToCustomerEntity(req, idCardImagePath, defaultCreditFromConfig)

	if customerType.TypeName == "GARAGE" {
		newCustomer.IsDiscountEnabled = true
		newCustomer.OntopDiscountRate = 0.00 // ตัวอย่างค่าเริ่มต้นสำหรับอู่พันธมิตร
	} else {
		newCustomer.IsDiscountEnabled = false
		newCustomer.OntopDiscountRate = 0.00
	}

	return s.repo.CreateCustomer(newCustomer)
}

func (s *customerService) UpdateCustomer(id uint, req customerDto.UpdateCustomerRequest, userID uint) error {
	customer, err := s.repo.GetCustomerByID(id)
	if err != nil {
		return errors.New("ไม่พบข้อมูลสมาชิกคนนี้ในระบบ")
	}

	// ตรวจสอบเลขบัตรประชาชนซ้ำกับลูกค้ารายอื่นหรือไม่
	encIdCard, _ := crypto.EncryptAES256(req.IdCardNumberCustomer)
	var countIdCard int64
	s.db.Model(&entity.Customer{}).Where("(id_card_number_customer = ? OR id_card_number_customer = ?) AND id != ?", encIdCard, req.IdCardNumberCustomer, id).Count(&countIdCard)
	if countIdCard > 0 {
		return errors.New("เลขบัตรประชาชนนี้เคยลงทะเบียนในระบบแล้ว")
	}

	// ตรวจสอบเบอร์โทรศัพท์ซ้ำกับลูกค้ารายอื่นหรือไม่
	var countPhone int64
	s.db.Model(&entity.Customer{}).Where("phone_number = ? AND id != ?", req.PhoneNumber, id).Count(&countPhone)
	if countPhone > 0 {
		return errors.New("หมายเลขโทรศัพท์นี้เคยลงทะเบียนในระบบแล้ว")
	}

	var customerType entity.CustomerType
	if err := s.db.First(&customerType, req.CustomerTypeID).Error; err != nil {
		return errors.New("ประเภทลูกค้าที่เลือกไม่ถูกต้อง")
	}

	oldName := customer.CustomerName
	customer.CustomerName = req.CustomerName
	customer.CustomerTypeID = req.CustomerTypeID
	customer.PhoneNumber = req.PhoneNumber
	customer.IdCardNumberCustomer = req.IdCardNumberCustomer
	customer.RegisteredAddress = req.RegisteredAddress
	customer.ShippingAddress = req.ShippingAddress

	if req.IdCardImagePath != "" {
		customer.IdCardImagePath = req.IdCardImagePath
	}
	if req.CreditLimit != nil && *req.CreditLimit >= 0 {
		customer.CreditLimit = *req.CreditLimit
	}
	if req.StandardDiscountRate != nil && *req.StandardDiscountRate >= 0 {
		customer.StandardDiscountRate = *req.StandardDiscountRate
	}
	if req.IsDiscountEnabled != nil {
		customer.IsDiscountEnabled = *req.IsDiscountEnabled
	}
	if req.OntopDiscountRate != nil && *req.OntopDiscountRate >= 0 {
		customer.OntopDiscountRate = *req.OntopDiscountRate
	}

	if err := s.repo.UpdateCustomer(customer); err != nil {
		return err
	}

	details := fmt.Sprintf("แก้ไขข้อมูลทั่วไปของลูกค้า: %s (เบอร์โทร: %s, บัตรประชาชน: %s)", customer.CustomerName, customer.PhoneNumber, customer.IdCardNumberCustomer)
	s.recordCustomerAuditLog(&customer.ID, oldName, "แก้ไขข้อมูลลูกค้า", details, userID)
	return nil
}


func (s *customerService) GetAllCustomers() ([]customerDto.CustomerResponse, error) {
	customers, err := s.repo.GetAllCustomers() 
	if err != nil {
		return nil, err
	}
	return customerDto.ToCustomerListResponse(customers), nil
}

func (s *customerService) GetCustomerByID(id uint) (customerDto.CustomerDetailResponse, error) {
	customer, err := s.repo.GetCustomerByID(id)
	if err != nil {
		return customerDto.CustomerDetailResponse{}, err 
	}

	// เติม * ไว้หน้า customer เพื่อแปลงร่างจาก *entity.Customer เป็น entity.Customer ธรรมดา
	return customerDto.ToCustomerDetailResponse(*customer), nil
}

func (s *customerService) recordCustomerAuditLog(customerID *uint, customerName, action, details string, userID uint) {
	userName := "เจ้าของร้าน"
	var userPtr *uint
	if userID > 0 {
		userPtr = &userID
		if user, err := s.repo.GetUserByID(userID); err == nil && user != nil {
			fullName := strings.TrimSpace(user.FirstName + " " + user.LastName)
			if fullName != "" {
				userName = fullName
			} else if user.Username != "" {
				userName = user.Username
			}
		}
	}

	log := &entity.CustomerCreditAuditLog{
		CustomerID:   customerID,
		CustomerName: customerName,
		Action:       action,
		Details:      details,
		ChangedBy:    userName,
		UserID:       userPtr,
	}
	_ = s.repo.CreateCreditAuditLog(log)
}

func (s *customerService) UpdateCustomerDiscount(id uint, req customerDto.UpdateCustomerDiscountRequest, userID uint) error {
	customer, err := s.repo.GetCustomerByID(id)
	if err != nil {
		return errors.New("ไม่พบข้อมูลสมาชิกคนนี้ในระบบ")
	}

	oldEnabled := customer.IsDiscountEnabled
	oldOntop := customer.OntopDiscountRate
	oldCredit := customer.CreditLimit
	oldStandard := customer.StandardDiscountRate

	customer.IsDiscountEnabled = req.IsDiscountEnabled
	customer.OntopDiscountRate = req.OntopDiscountRate
	if req.CreditLimit != nil && *req.CreditLimit >= 0 {
		customer.CreditLimit = *req.CreditLimit
	}
	if req.StandardDiscountRate != nil && *req.StandardDiscountRate >= 0 {
		customer.StandardDiscountRate = *req.StandardDiscountRate
	}

	if err := s.repo.UpdateCustomerDiscountRequest(customer); err != nil {
		return err
	}

	// บันทึก Audit Log อัตโนมัติเมื่อมีการเปลี่ยนแปลง
	if oldEnabled != req.IsDiscountEnabled || oldOntop != req.OntopDiscountRate || (req.CreditLimit != nil && oldCredit != *req.CreditLimit) || (req.StandardDiscountRate != nil && oldStandard != *req.StandardDiscountRate) {
		action := "แก้ไขสิทธิ์และส่วนลดลูกค้า"
		if oldEnabled != req.IsDiscountEnabled && oldOntop == req.OntopDiscountRate && (req.CreditLimit == nil || oldCredit == *req.CreditLimit) {
			if req.IsDiscountEnabled {
				action = "เปิดสิทธิ์ส่วนลดพิเศษ"
			} else {
				action = "ระงับสิทธิ์ส่วนลดพิเศษ"
			}
		} else if req.CreditLimit != nil && oldCredit != *req.CreditLimit && oldEnabled == req.IsDiscountEnabled && oldOntop == req.OntopDiscountRate {
			action = "ปรับวงเงินเครดิตลูกค้า"
		}
		statusText := "ปิดใช้งาน"
		if req.IsDiscountEnabled {
			statusText = "เปิดใช้งาน"
		}
		details := fmt.Sprintf("สถานะสิทธิ์ส่วนลด: %s, On-Top: %.2f%%, ส่วนลดมาตรฐาน: %.2f%%, วงเงินเครดิต: ฿%.2f", statusText, req.OntopDiscountRate, customer.StandardDiscountRate, customer.CreditLimit)
		s.recordCustomerAuditLog(&customer.ID, customer.CustomerName, action, details, userID)
	}

	return nil
}

func (s *customerService) CreateCreditAuditLog(req customerDto.CreateCustomerCreditAuditLogRequest, userID uint) error {
	s.recordCustomerAuditLog(req.CustomerID, req.CustomerName, req.Action, req.Details, userID)
	return nil
}

func (s *customerService) GetCreditAuditLogs() ([]customerDto.CustomerCreditAuditLogResponse, error) {
	logs, err := s.repo.GetCreditAuditLogs(100)
	if err != nil {
		return nil, err
	}
	res := make([]customerDto.CustomerCreditAuditLogResponse, 0, len(logs))
	for i := range logs {
		res = append(res, *customerDto.ToCustomerCreditAuditLogResponse(&logs[i]))
	}
	return res, nil
}
