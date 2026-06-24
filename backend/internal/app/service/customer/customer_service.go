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
	// กำหนดค่าเริ่มต้นของ CreditLimit ตามนโยบายร้านค้า
	defaultCreditFromConfig := 50000.00 // ตัวอย่างค่าที่กำหนดเอง

	newCustomer := customerDto.ToCustomerEntity(req, idCardImagePath, defaultCreditFromConfig)

	return s.repo.CreateCustomer(newCustomer)
}

func (s *customerService) GetAllCustomers() ([]customerDto.CustomerResponse, error) {
	customers, err := s.repo.GetallCustomers()
	if err != nil {
		return nil, err
	}
	return customerDto.ToCustomerListResponse(customers), nil
}