package purchaseorders

import (
	"context"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
)

// PurchaseOrderRepository คุมตาราง purchase_orders และ po_items
type PurchaseOrderRepository interface {
	Save(ctx context.Context, po *poEntity.PO) error
	FindByID(ctx context.Context, id uint) (*poEntity.PO, error)
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
// type userRepository struct {
// 	db *gorm.DB
// }
// func NewUserRepository(db *gorm.DB) UserRepository {
// 	return &userRepository{db: db}
// }

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
func (r *purchaseOrderRepository) FindByID(ctx context.Context, id uint) (*poEntity.PO, error) {
	var po poEntity.PO

	err := r.db.WithContext(ctx).Preload("PO_Items").First(&po, id).Error
		
	if err != nil {
		return nil, err
	}

	return &po, nil
}