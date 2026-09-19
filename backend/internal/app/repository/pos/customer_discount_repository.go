package pos

import (
	"backend/internal/app/entity"
	"strings"
	"time"
	"gorm.io/gorm"
)

type CustomerDebtAging struct {
	CustomerID     uint
	MaxUnpaidDays  int
	HasUnpaidOrder bool
	IsOverdue      bool
}

type CustomerDiscountRepository interface {
	SearchCustomers(searchQuery string) ([]entity.Customer, error)
	GetCreditCustomerByID(id uint) (*entity.Customer, error)
	GetCreditCustomers() ([]entity.Customer, error)
	UpdateCustomer(customer *entity.Customer) error
	GetCustomersDebtAging() (map[uint]CustomerDebtAging, error)
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

func (r *customerDiscountRepository) GetCustomersDebtAging() (map[uint]CustomerDebtAging, error) {
	result := make(map[uint]CustomerDebtAging)

	// ดึง StoreConfig จาก Database จริงเพื่อตรวจสอบ max_overdue_days ตามนโยบายร้าน
	var storeConfig entity.StoreConfig
	maxOverdueLimit := 0
	if err := r.db.Order("id asc").First(&storeConfig).Error; err == nil {
		maxOverdueLimit = storeConfig.MaxOverdueDays
	}

	type row struct {
		CustomerID  uint       `gorm:"column:customer_id"`
		OldestOrder time.Time  `gorm:"column:oldest_order"`
		MinDueDate  *time.Time `gorm:"column:min_due_date"`
	}

	var rows []row
	err := r.db.Table("sale_orders").
		Select("customer_id, MIN(order_date) as oldest_order, MIN(due_date) as min_due_date").
		Where("deleted_at IS NULL AND balance_due > 0 AND customer_id IS NOT NULL AND status NOT IN (?, ?)", "cancelled", "refunded").
		Group("customer_id").
		Scan(&rows).Error
	if err != nil {
		return nil, err
	}

	now := time.Now()
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())

	for _, rw := range rows {
		orderDate := time.Date(rw.OldestOrder.Year(), rw.OldestOrder.Month(), rw.OldestOrder.Day(), 0, 0, 0, 0, rw.OldestOrder.Location())
		days := int(today.Sub(orderDate).Hours() / 24)
		if days < 0 {
			days = 0
		}

		isOverdue := false
		if rw.MinDueDate != nil {
			dueDay := time.Date(rw.MinDueDate.Year(), rw.MinDueDate.Month(), rw.MinDueDate.Day(), 23, 59, 59, 0, rw.MinDueDate.Location())
			if now.After(dueDay) {
				isOverdue = true
			}
		} else if maxOverdueLimit > 0 && days > maxOverdueLimit {
			isOverdue = true
		}

		result[rw.CustomerID] = CustomerDebtAging{
			CustomerID:     rw.CustomerID,
			MaxUnpaidDays:  days,
			HasUnpaidOrder: true,
			IsOverdue:      isOverdue,
		}
	}

	return result, nil
}