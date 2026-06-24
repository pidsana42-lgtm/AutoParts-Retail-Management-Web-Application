package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type CustomerDiscountRepository interface {
	GetCreditCustomerByID(id uint) (*entity.Customer, error)
	GetCreditCustomers() ([]entity.Customer, error)
	UpdateCustomer(customer *entity.Customer) error
}

type customerDiscountRepository struct {
	db *gorm.DB
}

func NewCustomerDiscountRepository(db *gorm.DB) CustomerDiscountRepository {
	return &customerDiscountRepository{db: db}
}

func (r *customerDiscountRepository) GetCreditCustomers() ([]entity.Customer, error) {
	var customers []entity.Customer
	err := r.db.Order("id asc").Where("customer_type_id = ?", 2).Find(&customers).Error
	return customers, err
}

func (r *customerDiscountRepository) GetCreditCustomerByID(id uint) (*entity.Customer, error) {
	var customer entity.Customer
	err := r.db.Where("id = ? AND customer_type_id = ?", id, 2).First(&customer).Error
	return &customer, err
}

func (r *customerDiscountRepository) UpdateCustomer(customer *entity.Customer) error {
	return r.db.Save(customer).Error
}