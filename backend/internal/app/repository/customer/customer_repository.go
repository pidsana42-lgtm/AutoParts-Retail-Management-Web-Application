package customer

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type CustomerRepository interface {
	CreateCustomer(customer *entity.Customer) error
	GetAllCustomers() ([]entity.Customer, error)
	GetCustomerByID(id uint) (*entity.Customer, error)

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

