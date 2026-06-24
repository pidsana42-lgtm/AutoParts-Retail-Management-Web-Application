package customer

import (
	customerRepo "backend/internal/app/repository/customer"
	customerDto "backend/internal/app/dto/customer"
)

type CustomerService interface {
	RegisterNewCustomer(customer customerDto.RegisterCustomerRequest, idCardImagePath string) error
}

type customerService struct {
	repo customerRepo.CustomerRepository
}

func NewCustomerService(repo customerRepo.CustomerRepository) CustomerService {
	return &customerService{repo: repo}
}

func (s *customerService) RegisterNewCustomer(req customerDto.RegisterCustomerRequest, idCardImagePath string) error {
	// กำหนดค่าเริ่มต้นของ CreditLimit ตามนโยบายร้านค้า
	defaultCreditFromConfig := 50000.00 // ตัวอย่างค่าที่กำหนดเอง

	newCustomer := customerDto.ToCustomerEntity(req, idCardImagePath, defaultCreditFromConfig)

	return s.repo.CreateCustomer(newCustomer)
}