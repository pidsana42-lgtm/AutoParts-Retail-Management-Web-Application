package customer

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type CustomerRepository interface {
	CreateCustomer(customer *entity.Customer) error
	GetAllCustomers() ([]entity.Customer, error)
	GetCustomerByID(id uint) (*entity.Customer, error)
	UpdateCustomer(customer *entity.Customer) error
	UpdateCustomerDiscountRequest(customer *entity.Customer) error
	CreateCreditAuditLog(log *entity.CustomerCreditAuditLog) error
	GetCreditAuditLogs(limit int) ([]entity.CustomerCreditAuditLog, error)
	GetUserByID(userID uint) (*entity.User, error)
}

type customerRepository struct {
	db *gorm.DB
}

func NewCustomerRepository(db *gorm.DB) CustomerRepository {
	return &customerRepository{db: db}
	
}

func (r *customerRepository) CreateCustomer(customer *entity.Customer) error {
	return r.db.Create(customer).Error
}

func (r *customerRepository) GetAllCustomers() ([]entity.Customer, error) {
	var customers []entity.Customer
	err := r.db.Preload("CustomerType").Find(&customers).Error
	return customers, err
}

func (r *customerRepository) GetCustomerByID(id uint) (*entity.Customer, error) {
	var customer entity.Customer
	err := r.db.Preload("CustomerType").First(&customer, id).Error
	return &customer, err
}

func (r *customerRepository) UpdateCustomer(customer *entity.Customer) error {
	return r.db.Omit("CustomerType").Save(customer).Error
}

func (r *customerRepository) UpdateCustomerDiscountRequest(customer *entity.Customer) error {
	return r.db.Save(customer).Error
}

func (r *customerRepository) CreateCreditAuditLog(log *entity.CustomerCreditAuditLog) error {
	return r.db.Create(log).Error
}

func (r *customerRepository) GetCreditAuditLogs(limit int) ([]entity.CustomerCreditAuditLog, error) {
	var logs []entity.CustomerCreditAuditLog
	if limit <= 0 {
		limit = 100
	}
	err := r.db.Order("created_at desc").Limit(limit).Find(&logs).Error
	return logs, err
}

func (r *customerRepository) GetUserByID(userID uint) (*entity.User, error) {
	var user entity.User
	err := r.db.First(&user, userID).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}