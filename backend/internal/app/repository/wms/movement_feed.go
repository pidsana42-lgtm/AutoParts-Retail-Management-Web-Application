package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

// จำนวนรายการล่าสุดสูงสุดที่ดึงต่อแหล่งข้อมูล — กันไม่ให้ query หนักเกินไปเวลาข้อมูลสะสมเยอะขึ้นเรื่อยๆ
// หน้าเว็บเป็นฟีดกิจกรรม "ล่าสุด" อยู่แล้ว ถ้าต้องการดูย้อนหลังไกลกว่านี้ให้ไปดูที่หน้าตารางต้นทางโดยตรง (เช่น รายการสินค้า/ตารางเช็คสต็อก)
const movementFeedLimit = 300

// MovementFeedRepository: ดึงข้อมูลดิบจากตารางต้นทางต่างๆ ที่เกี่ยวกับ "การเคลื่อนไหวของสินค้า" ฝั่ง WMS
// (ฝั่งอื่น เช่น การขาย/ใบสั่งซื้อ/เคลม/พรีออเดอร์ เป็นของทีมอื่นตาม work.md จะต่อเพิ่มเป็นเมธอดใหม่ทีหลังได้)
type MovementFeedRepository interface {
	ListRecentProducts() ([]entity.Product, error)            // สินค้าถูกเพิ่มเข้าระบบใหม่
	ListStockInMovements() ([]entity.StockMovement, error)    // สินค้าถูกนำเข้า/รับเพิ่ม
	ListCheckSchedules() ([]entity.CheckStockSchedule, error) // สินค้าถูกแจ้งเช็คสต็อก
	ListStockAdjustments() ([]entity.CheckStock, error)       // สต็อกถูกปรับหลังอนุมัติผลเช็คสต็อก
	ListLowStockProducts() ([]entity.Product, error)          // สินค้าใกล้หมด
}

type movementFeedRepository struct {
	db *gorm.DB
}

func NewMovementFeedRepository(db *gorm.DB) MovementFeedRepository {
	return &movementFeedRepository{db: db}
}

func (r *movementFeedRepository) ListRecentProducts() ([]entity.Product, error) {
	var products []entity.Product
	err := r.db.Order("created_at desc").Limit(movementFeedLimit).Find(&products).Error
	return products, err
}

func (r *movementFeedRepository) ListStockInMovements() ([]entity.StockMovement, error) {
	var list []entity.StockMovement
	err := r.db.
		Preload("Product").
		Preload("Supplier").
		Preload("User").
		Where("movement_type = ?", "IN").
		Order("movement_date_time desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}

func (r *movementFeedRepository) ListCheckSchedules() ([]entity.CheckStockSchedule, error) {
	var list []entity.CheckStockSchedule
	err := r.db.
		Preload("User").
		Order("created_at desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}

// ปรับสต็อก = เฉพาะแถวที่นับได้ไม่ตรงกับระบบจริง (diff_quantity != 0) เท่านั้น — ถ้านับตรงเป๊ะไม่ถือว่าเป็น "การเคลื่อนไหว"
func (r *movementFeedRepository) ListStockAdjustments() ([]entity.CheckStock, error) {
	var list []entity.CheckStock
	err := r.db.
		Preload("Product").
		Preload("User").
		Where("diff_quantity != 0").
		Order("adjustment_date_time desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}

// ใกล้หมด = คงเหลือ <= จุดสั่งซื้อที่ตั้งไว้ และต้องตั้งจุดสั่งซื้อไว้จริง (> 0) ไม่งั้นสินค้าที่ยังไม่เคยตั้งค่าจะถูกนับเป็น "ใกล้หมด" ทุกชิ้น
func (r *movementFeedRepository) ListLowStockProducts() ([]entity.Product, error) {
	var list []entity.Product
	err := r.db.
		Preload("Unit").
		Where("limit_quantity > 0 AND quantity <= limit_quantity").
		Order("updated_at desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}
