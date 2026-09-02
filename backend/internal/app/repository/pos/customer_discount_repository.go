package pos

import (
	"backend/internal/app/entity"
	"strings"
	"gorm.io/gorm"
)

type CustomerDiscountRepository interface {
	SearchCustomers(searchQuery string) ([]entity.Customer, error)
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
	err := r.db.Where("id = ?", id).First(&customer).Error
	return &customer, err
}

func (r *customerDiscountRepository) UpdateCustomer(customer *entity.Customer) error {
	return r.db.Save(customer).Error
}

func (r *customerDiscountRepository) SearchCustomers(searchQuery string) ([]entity.Customer, error) {
    var customers []entity.Customer
    
    query := r.db.Preload("CustomerType").Model(&entity.Customer{})
    
    if searchQuery != "" {
        cleaned := strings.ReplaceAll(strings.ReplaceAll(searchQuery, "-", ""), " ", "")
        likeQuery := "%" + searchQuery + "%"
        likeCleaned := "%" + cleaned + "%"
        query = query.Where(
            "customer_name LIKE ? OR phone_number LIKE ? OR id_card_number_customer LIKE ? OR REPLACE(REPLACE(phone_number, '-', ''), ' ', '') LIKE ? OR REPLACE(REPLACE(id_card_number_customer, '-', ''), ' ', '') LIKE ?",
            likeQuery, likeQuery, likeQuery, likeCleaned, likeCleaned,
        )
    }
    
    err := query.Find(&customers).Error
    return customers, err
}