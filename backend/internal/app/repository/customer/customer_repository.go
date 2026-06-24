package customer

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type CustomerRepository interface {
	CreateCustomer(customer *entity.Customer) error
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