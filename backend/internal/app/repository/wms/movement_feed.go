package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

// จำนวนรายการล่าสุดสูงสุดที่ดึงต่อแหล่งข้อมูล — กันไม่ให้ query หนักเกินไปเวลาข้อมูลสะสมเยอะขึ้นเรื่อยๆ
// หน้าเว็บเป็นฟีดกิจกรรม "ล่าสุด" อยู่แล้ว ถ้าต้องการดูย้อนหลังไกลกว่านี้ให้ไปดูที่หน้าตารางต้นทางโดยตรง (เช่น รายการสินค้า/ตารางเช็คสต็อก)
const movementFeedLimit = 300

// MovementFeedRepository: ดึงข้อมูลดิบจากตารางต้นทางต่างๆ ที่เกี่ยวกับ "การเคลื่อนไหวของสินค้า"
// ทั้งฝั่ง WMS และฝั่งทีมอื่น (ขาย/คืน-เคลม/พรีออเดอร์) — อ่านอย่างเดียวเสมอ ไม่แก้ business logic ของตารางต้นทาง
type MovementFeedRepository interface {
	ListRecentProducts() ([]entity.Product, error)            // สินค้าถูกเพิ่มเข้าระบบใหม่
	ListStockInMovements() ([]entity.StockMovement, error)    // สินค้าถูกนำเข้า/รับเพิ่ม
	ListCheckSchedules() ([]entity.CheckStockSchedule, error) // สินค้าถูกแจ้งเช็คสต็อก
	ListStockAdjustments() ([]entity.CheckStock, error)       // สต็อกถูกปรับหลังอนุมัติผลเช็คสต็อก
	ListLowStockProducts() ([]entity.Product, error)          // สินค้าใกล้หมด

	ListSaleOutItems() ([]entity.SaleOrderItem, error)         // สินค้าถูกขายออกผ่าน POS (เฉพาะออเดอร์ที่ completed)
	ListReturnMovements() ([]entity.StockMovement, error)      // ลูกค้าคืนสินค้า
	ListCustomerClaimItems() ([]entity.CustomerClaimItem, error) // ลูกค้าแจ้งเคลมสินค้า
	ListPreOrderItems() ([]entity.PreOrderItem, error)         // สร้างพรีออเดอร์สั่งจองกับบริษัท
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

// ขายออก (POS) = ทุกสถานะรวมถึง cancelled ด้วย — โชว์ทุกออเดอร์ที่เคยเกิดขึ้นไว้ในหมวด POS เดียวกันหมด
// (แม้ภายหลังจะถูกยกเลิกและสต็อกถูกคืนกลับแล้ว ก็ยังโชว์ไว้เป็นประวัติ พร้อมป้ายสถานะ "ยกเลิกแล้ว" กำกับ ไม่ซ่อนออกไปเฉยๆ)
func (r *movementFeedRepository) ListSaleOutItems() ([]entity.SaleOrderItem, error) {
	var list []entity.SaleOrderItem
	err := r.db.
		Select("sale_order_items.*").
		Joins("JOIN sale_orders ON sale_orders.id = sale_order_items.order_id").
		Preload("Order").
		Preload("Order.CreatedBy").
		Preload("Product").
		Order("sale_orders.order_date desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}

// คืนสินค้า: ทีมคืนสินค้าเขียนแถว stock_movements (movement_type = RETURN) ไว้ให้อยู่แล้วตอนอนุมัติคำขอคืน จึงอ่านจากตรงนี้ได้เลย
func (r *movementFeedRepository) ListReturnMovements() ([]entity.StockMovement, error) {
	var list []entity.StockMovement
	err := r.db.
		Preload("Product").
		Preload("User").
		Where("movement_type = ?", "RETURN").
		Order("movement_date_time desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}

// เคลมสินค้า: เรียงตามวันที่แจ้งเคลมของใบเคลม (ตาราง item เองไม่มีวันที่ของตัวเอง)
func (r *movementFeedRepository) ListCustomerClaimItems() ([]entity.CustomerClaimItem, error) {
	var list []entity.CustomerClaimItem
	err := r.db.
		Select("customer_claim_items.*").
		Joins("JOIN customer_claims ON customer_claims.id = customer_claim_items.customer_claim_id").
		Preload("CustomerClaim").
		Preload("CustomerClaim.CreatedByUser").
		Preload("Product").
		Order("customer_claims.claim_date desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}

// พรีออเดอร์ = ตัดรายการที่ยกเลิกไปแล้วออก เพราะไม่ถือเป็น "การเคลื่อนไหว" ที่เกิดขึ้นจริง
func (r *movementFeedRepository) ListPreOrderItems() ([]entity.PreOrderItem, error) {
	var list []entity.PreOrderItem
	err := r.db.
		Select("pre_order_items.*").
		Joins("JOIN pre_orders ON pre_orders.id = pre_order_items.pre_order_id").
		Where("pre_order_items.status != ?", "CANCELLED").
		Preload("PreOrder").
		Preload("PreOrder.Supplier").
		Preload("Product").
		Order("pre_orders.order_date desc").
		Limit(movementFeedLimit).
		Find(&list).Error
	return list, err
}
