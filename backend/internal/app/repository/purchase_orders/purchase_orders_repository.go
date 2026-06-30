package purchaseorders

import (
	"context"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
	poDto "backend/internal/app/dto/purchase_orders"
)

// PurchaseOrderRepository คุมตาราง purchase_orders และ po_items
type PurchaseOrderRepository interface {
	Save(ctx context.Context, po *poEntity.PO) error
	FindAll(ctx context.Context, query poDto.ListPOQuery) ([]poEntity.PO, int64, error)
}

// ProductRepository คุมตาราง products (เอาไว้ให้ Service ไปหาข้อมูลมาทำ Snapshot)
type ProductRepository interface {
	GetProductByID(ctx context.Context, id uint) (*poEntity.Product, error)
}

// SupplierRepository คุมตาราง suppliers
type SupplierRepository interface {
	GetSupplierByID(ctx context.Context, id uint) (*poEntity.Supplier, error)
}

// UserRepository คุมตาราง users
type UserRepository interface {
	FindByID(ctx context.Context, id uint) (*poEntity.User, error)
}

type purchaseOrderRepository struct {
	db *gorm.DB
}

// NewPurchaseOrderRepository ใช้สำหรับส่ง gorm.DB เข้ามาตอนเริ่มระบบ
func NewPORepository(db *gorm.DB) PurchaseOrderRepository {
	return &purchaseOrderRepository{
		db: db,
	}
}

// Supplier Repo
type supplierRepository struct {
	db *gorm.DB
}

func NewSupplierRepository(db *gorm.DB) SupplierRepository {
	return &supplierRepository{
		db: db,
	}
}

// Product Repo
type productRepository struct {
	db *gorm.DB
}
func NewProductRepository(db *gorm.DB) ProductRepository {
	return &productRepository{db: db}
}

// User Repo
type userRepository struct {
	db *gorm.DB
}
func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

// Save บันทึกใบสั่งซื้อพร้อมไอเทมลูกทั้งหมดลง Database (มีระบบ Transaction ป้องกันข้อมูลพัง)
func (r *purchaseOrderRepository) Save(ctx context.Context, po *poEntity.PO) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(po).Error; err != nil {
			return err
		}
		return nil
	})
}

// FindByID ดึงข้อมูลใบสั่งซื้อ 1 ใบ พร้อม Preload รายการสินค้า (POItems) ติดมาด้วย
func (r *userRepository) FindByID(ctx context.Context, id uint) (*poEntity.User, error) {
    var user poEntity.User
    
    err := r.db.WithContext(ctx).First(&user, id).Error
    
    if err != nil {
        return nil, err
    }
    
    return &user, nil
}

func (r *purchaseOrderRepository) FindAll(ctx context.Context, query poDto.ListPOQuery) ([]poEntity.PO, int64, error) {
	var pos []poEntity.PO
	var total int64

	// เริ่มต้น Query จาก Model PO
	dbQuery := r.db.WithContext(ctx).Model(&poEntity.PO{})

	// 1. ใส่ Logic การ Filter
	if query.Status != "" {
		dbQuery = dbQuery.Where("status = ?", query.Status)
	}
	if query.Search != "" {
		// ใช้ LIKE เพื่อค้นหา po_number
		dbQuery = dbQuery.Where("po_number LIKE ?", "%"+query.Search+"%")
	}
	if query.Date != "" {
		// ค้นหาตามวันที่ (ถ้าใช้ MySQL)
		dbQuery = dbQuery.Where("DATE(created_at) = ?", query.Date)
	}

	// 2. นับจำนวนทั้งหมดก่อน (Count ต้องทำก่อนการ Limit/Offset)
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 3. ดึงข้อมูลแบบ Pagination
	offset := (query.Page - 1) * query.Limit
	err := dbQuery.
		Preload("Creator").     // ดึงข้อมูล User ผู้สร้าง
		Preload("Supplier").    // ดึงข้อมูล Supplier
		Preload("PO_Items").    // ดึงข้อมูลรายการสินค้า
		Order("created_at DESC").
		Offset(offset).
		Limit(query.Limit).
		Find(&pos).Error

	return pos, total, err
}