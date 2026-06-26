package pos

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

// SaleRepository กำหนดสัญญา Interface ว่าตู้เอกสารใบนี้สามารถทำอะไรได้บ้าง
type SaleRepository interface {
	CreateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error
	GetStoreConfig() (*entity.StoreConfig, error)
	BeginTransaction() *gorm.DB
	GetPaymentMethodByID(id uint) (*entity.PaymentMethod, error)
}

type saleRepository struct {
	db *gorm.DB
}

// NewSaleRepository ใช้สำหรับสร้าง Instance เพื่อเอาไปผูกในชั้น Service
func NewSaleRepository(db *gorm.DB) SaleRepository {
	return &saleRepository{db: db}
}

// 1. BeginTransaction ใช้สำหรับเปิดระบบ "มัดรวมคำสั่ง (Transaction)" ในชั้น Service
func (r *saleRepository) BeginTransaction() *gorm.DB {
	return r.db.Begin()
}

// 2. CreateOrderWithTx ทำหน้าที่ยัดข้อมูล SaleOrder และลูก ๆ (Items) ลงเบสผ่านท่อ Transaction
func (r *saleRepository) CreateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error {
	// GORM จะฉลาดพอครับโบว์ พอเราสั่ง Save หัวบิลก้อนใหญ่ 
	// มันจะสอยเอาอาร์เรย์ Items ที่อยู่ข้างในไปสร้างลงตาราง SaleOrderItem ให้เองอัตโนมัติเลยครับ
	if err := tx.Create(order).Error; err != nil {
		return err
	}
	return nil
}

// 3. GetStoreConfig ใช้สำหรับดึงนโยบายร้านค้า (เช่น % ส่วนลดสูงสุด) ขึ้นมาให้ Service ตรวจสอบ
func (r *saleRepository) GetStoreConfig() (*entity.StoreConfig, error) {
	var config entity.StoreConfig
	// ดึงแถวแรกสุดของตารางขึ้นมาใช้ (เพราะ StoreConfig ส่วนใหญ่มีแค่แถวเดียวคุมทั้งระบบ)
	if err := r.db.First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func (r *saleRepository) GetPaymentMethodByID(id uint) (*entity.PaymentMethod, error) {
	var method entity.PaymentMethod
	if err := r.db.First(&method, id).Error; err != nil {
		return nil, err
	}
	return &method, nil
}