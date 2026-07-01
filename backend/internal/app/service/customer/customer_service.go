package customer

import (
	customerRepo "backend/internal/app/repository/customer"
	customerDto "backend/internal/app/dto/customer"
	"gorm.io/gorm"
	"backend/internal/app/entity"
	"errors"
)

type CustomerService interface {
	RegisterNewCustomer(customer customerDto.RegisterCustomerRequest, idCardImagePath string) error
	GetAllCustomers() ([]customerDto.CustomerResponse, error)
	GetCustomerByID(id uint) (customerDto.CustomerDetailResponse, error) 
	UpdateCustomerDiscount(id uint, req customerDto.UpdateCustomerDiscountRequest) error
}

type customerService struct {
	repo customerRepo.CustomerRepository
	db *gorm.DB
}

func NewCustomerService(repo customerRepo.CustomerRepository, db *gorm.DB) CustomerService {
	return &customerService{repo: repo, db: db}
}

func (s *customerService) RegisterNewCustomer(req customerDto.RegisterCustomerRequest, idCardImagePath string) error {
	
	var countIdCard int64
	s.db.Model(&entity.Customer{}).Where("id_card_number_customer = ?", req.IdCardNumberCustomer).Count(&countIdCard)
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
	// กำหนดค่าเริ่มต้นของ CreditLimit ตามนโยบายร้านค้า
	defaultCreditFromConfig := 50000.00 // ตัวอย่างค่าที่กำหนดเอง

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

func (s *customerService) UpdateCustomerDiscount(id uint, req customerDto.UpdateCustomerDiscountRequest) error {
	customer, err := s.repo.GetCustomerByID(id)
	if err != nil {
		return errors.New("ไม่พบข้อมูลสมาชิกคนนี้ในระบบ")
	}

	if customer.CustomerType.TypeName != "GARAGE" {
		return errors.New("ไม่สามารถปรับส่วนลดให้กับลูกค้าประเภทนี้ได้")
	}

	customer.IsDiscountEnabled = req.IsDiscountEnabled
	customer.OntopDiscountRate = req.OntopDiscountRate

	return s.repo.UpdateCustomerDiscountRequest(customer)
}
