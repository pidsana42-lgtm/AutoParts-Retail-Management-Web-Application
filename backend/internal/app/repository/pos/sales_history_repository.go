package pos

import (
    "backend/internal/app/dto/pos"
    "backend/internal/app/entity"

    "gorm.io/gorm"
    "strconv" 
)

type SalesHistoryRepository interface {
    GetSalesHistory(req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
    	GetSaleHistoryByID(identifier string) (*entity.SaleOrder, error)
}

type salesHistoryRepository struct {
    db *gorm.DB
}

func NewSalesHistoryRepository(db *gorm.DB) SalesHistoryRepository {
    return &salesHistoryRepository{db: db}
}

func (r *salesHistoryRepository) GetSalesHistory(req pos.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
    var orders []entity.SaleOrder
    var totalRows int64

    query := r.db.Model(&entity.SaleOrder{}).
        Preload("Customer").
		Preload("PaymentMethod").
        Preload("Payments.PaymentMethod")

    if req.Search != "" {
        query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("sale_orders.order_number LIKE ? OR sale_orders.customer_name_temp LIKE ? OR customers.customer_name LIKE ?",
                "%"+req.Search+"%", "%"+req.Search+"%", "%"+req.Search+"%")
    }

    if req.StartDate != "" && req.EndDate != "" {
        query = query.Where("sale_orders.created_at BETWEEN ? AND ?", req.StartDate+" 00:00:00", req.EndDate+" 23:59:59")
    }

    if req.CustomerTypeID != 0 {
        query = query.Joins("LEFT JOIN customers ON customers.id = sale_orders.customer_id").
            Where("customers.customer_type_id = ?", req.CustomerTypeID)
    }

    if req.PaymentMethodID != 0 {
        query = query.Joins("LEFT JOIN payments ON payments.order_id = sale_orders.id").
            Where("sale_orders.payment_method_id = ? OR payments.payment_method_id = ?", 
                req.PaymentMethodID, req.PaymentMethodID).
            Group("sale_orders.id") 
    }

    // นับจำนวนรายการทั้งหมดก่อนทำ Pagination
    if err := query.Count(&totalRows).Error; err != nil {
        return nil, 0, err
    }

    // เช็คเงื่อนไข Limit (ถ้าส่ง Limit มา > 0 ให้ทำ Pagination แต่ถ้า <= 0 จะดึงทั้งหมด)
    if req.Limit > 0 {
        // กันไว้ถ้าส่ง page มา <= 0 ให้ใช้หน้า 1
        page := req.Page
        if page <= 0 {
            page = 1
        }
        offset := (page - 1) * req.Limit
        query = query.Limit(req.Limit).Offset(offset)
    }

	query = query.Order("sale_orders.created_at DESC")

    // Query ข้อมูลออกไปใส่ตัวแปร orders
    if err := query.Find(&orders).Error; err != nil {
        return nil, 0, err
    }

    return orders, totalRows, nil
}

func (r *salesHistoryRepository) GetSaleHistoryByID(identifier string) (*entity.SaleOrder, error) {
	var order entity.SaleOrder

	// เช็คว่าถ้าสามารถแปลงเป็น uint ได้ แสดงว่าเป็น ID แต่ถ้าแปลงไม่ได้ แสดงว่าเป็น Order Number
	query := r.db.Model(&entity.SaleOrder{}).
		Preload("Customer").
		Preload("PaymentMethod").
		Preload("Payments").
		Preload("Items")

	id, err := strconv.ParseUint(identifier, 10, 64)
	if err == nil && id > 0 {
		// ค้นหาด้วย Primary Key ID
		err = query.Where("id = ?", id).First(&order).Error
	} else {
		// ค้นหาด้วย Order Number
		err = query.Where("order_number = ?", identifier).First(&order).Error
	}

	if err != nil {
		return nil, err
	}

	return &order, nil
}