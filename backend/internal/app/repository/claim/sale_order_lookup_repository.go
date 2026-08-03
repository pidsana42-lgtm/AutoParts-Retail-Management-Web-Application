package claim

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type SaleOrderLookupRepository interface {
	GetSaleOrderByID(id uint) (*entity.SaleOrder, error)
	GetSaleOrderByNumber(orderNumber string) (*entity.SaleOrder, error)
	SearchSaleOrders(query string) ([]entity.SaleOrder, error)
}

type saleOrderLookupRepository struct {
	db *gorm.DB
}

func NewSaleOrderLookupRepository(db *gorm.DB) SaleOrderLookupRepository {
	return &saleOrderLookupRepository{db: db}
}

func (r *saleOrderLookupRepository) GetSaleOrderByID(id uint) (*entity.SaleOrder, error) {
	var order entity.SaleOrder
	err := r.db.Select("id, order_number").First(&order, id).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *saleOrderLookupRepository) GetSaleOrderByNumber(orderNumber string) (*entity.SaleOrder, error) {
	var order entity.SaleOrder
	err := r.db.Preload("Customer").
		Preload("Items").
		Where("order_number = ?", orderNumber).
		First(&order).Error
	if err != nil {
		return nil, err
	}
	return &order, nil
}

func (r *saleOrderLookupRepository) SearchSaleOrders(query string) ([]entity.SaleOrder, error) {
	orders := make([]entity.SaleOrder, 0)
	like := "%" + query + "%"
	err := r.db.Preload("Customer").
		Preload("Items").
		Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id AND customers.deleted_at IS NULL").
		Where(
			"sale_orders.order_number ILIKE ? OR customers.customer_name ILIKE ? OR sale_orders.customer_name_temp ILIKE ?",
			like, like, like,
		).
		Where("sale_orders.deleted_at IS NULL").
		Limit(10).
		Find(&orders).Error
	return orders, err
}
