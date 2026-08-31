package pre_oder

import (
	"backend/internal/app/entity"
	"context"
	"gorm.io/gorm"
)

// 1. กำหนด Interface สำหรับ PreOrder Repository
type PreOrderRepository interface {
	CreatePreOrder(preOrder *entity.PreOrder) error
	CreatePreOrderItem(item *entity.PreOrderItem) error
	GetPreOrderByID(id uint) (*entity.PreOrder, error)
	ListPreOrders() ([]entity.PreOrder, error)
	UpdatePreOrder(preOrder *entity.PreOrder) error
	DeletePreOrder(id uint) error
	GetLineUserIDByCustomerID(customerID uint) (string, error)
	ListByStatus(ctx context.Context, status string) ([]entity.PreOrder, error)
	UpdateItemsStatusByIDs(ctx context.Context, ids []uint, status string) error
	GetLinkedPOsByItemIDs(ctx context.Context, itemIDs []uint) (map[uint]entity.PO, error)
}

// 2. สร้าง Struct สำหรับ Implement Interface
type preOrderRepository struct {
	db *gorm.DB
}

// 3. ฟังก์ชันสำหรับสร้าง Repository Instance
func NewPreOrderRepository(db *gorm.DB) PreOrderRepository {
	return &preOrderRepository{db: db}
}

func (r *preOrderRepository) GetLineUserIDByCustomerID(customerID uint) (string, error) {
	var lu entity.LineUser
	err := r.db.Where("customer_id = ?", customerID).First(&lu).Error
	if err != nil {
		return "", err
	}
	return lu.LineUserID, nil
}

// 4. Implement Method: สร้างข้อมูล Pre-Order ใหม่
func (r *preOrderRepository) CreatePreOrder(preOrder *entity.PreOrder) error {
	return r.db.Create(preOrder).Error
}

func (r *preOrderRepository) CreatePreOrderItem(item *entity.PreOrderItem) error {
	return r.db.Create(item).Error
}

// 5. Implement Method: ดึงข้อมูล Pre-Order ตาม ID
func (r *preOrderRepository) GetPreOrderByID(id uint) (*entity.PreOrder, error) {
	var preOrder entity.PreOrder

	// ใช้ Preload ดึงข้อมูลลูกค้า, ซัพพลายเออร์ และรายการสินค้าในบิลพรีออเดอร์
	err := r.db.Preload("Customer").
		Preload("Supplier").
		Preload("PreOrderItems").
		Preload("PreOrderItems.Product").
		Preload("PreOrderItems.Product.Inventories.Supplier").
		First(&preOrder, id).Error

	if err != nil {
		return nil, err
	}
	return &preOrder, nil
}

// 6. Implement Method: ดึงรายการ Pre-Order ทั้งหมด
func (r *preOrderRepository) ListPreOrders() ([]entity.PreOrder, error) {
	var preOrders []entity.PreOrder

	// ใช้ Preload เช่นเดียวกันเพื่อให้แสดงผลในหน้ารายการได้ครบถ้วน
	err := r.db.Preload("Customer").
		Preload("Supplier").
		Preload("PreOrderItems").
		Preload("PreOrderItems.Product").
		Preload("PreOrderItems.Product.Inventories.Supplier").
		Order("id DESC").
		Find(&preOrders).Error

	return preOrders, err
}

// 7. Implement Method: อัปเดตข้อมูล Pre-Order (เช่น อัปเดตสถานะการสั่งซื้อ หรือยอดมัดจำ)
func (r *preOrderRepository) UpdatePreOrder(preOrder *entity.PreOrder) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// 1. ลบไอเทมเดิมออกก่อนเพื่อไม่ให้เกิดขยะตกค้าง
		if err := tx.Where("pre_order_id = ?", preOrder.ID).Delete(&entity.PreOrderItem{}).Error; err != nil {
			return err
		}
		// 2. บันทึก parent และบันทึกไอเทมใหม่
		return tx.Session(&gorm.Session{FullSaveAssociations: true}).Save(preOrder).Error
	})
}

// 8. Implement Method: ลบข้อมูล Pre-Order (Soft Delete)
func (r *preOrderRepository) DeletePreOrder(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		// ลบไอเทมย่อยก่อน
		if err := tx.Where("pre_order_id = ?", id).Delete(&entity.PreOrderItem{}).Error; err != nil {
			return err
		}
		// ลบใบจองตัวหลัก
		return tx.Delete(&entity.PreOrder{}, id).Error
	})
}

// 9. Implement Method: ค้นหา PreOrder ตามสถานะของ Item
func (r *preOrderRepository) ListByStatus(ctx context.Context, status string) ([]entity.PreOrder, error) {
	var preOrders []entity.PreOrder

	err := r.db.WithContext(ctx).
		Preload("Customer").
		Preload("Supplier").
		Preload("PreOrderItems", "status = ?", status).
		Preload("PreOrderItems.Product").
		Preload("PreOrderItems.Product.Unit").
		Preload("PreOrderItems.Product.Inventories.Supplier").
		Where("EXISTS (SELECT 1 FROM pre_order_items WHERE pre_order_items.pre_order_id = pre_orders.id AND pre_order_items.status = ?)", status).
		Find(&preOrders).Error

	return preOrders, err
}

// 10. Implement Method: อัปเดตสถานะของ PreOrderItem แบบ Bulk
func (r *preOrderRepository) UpdateItemsStatusByIDs(ctx context.Context, ids []uint, status string) error {
	if len(ids) == 0 {
		return nil
	}

	return r.db.WithContext(ctx).
		Model(&entity.PreOrderItem{}).
		Where("id IN ?", ids).
		Update("status", status).Error
}

// 11. Implement Method: ดึงข้อมูล PO ที่ถูกผูกกับ PreOrderItems
func (r *preOrderRepository) GetLinkedPOsByItemIDs(ctx context.Context, itemIDs []uint) (map[uint]entity.PO, error) {
	result := make(map[uint]entity.PO)
	if len(itemIDs) == 0 {
		return result, nil
	}

	var poItems []entity.POItems
	err := r.db.WithContext(ctx).
		Preload("PO").
		Where("pre_order_item_id IN ? AND po_id IS NOT NULL", itemIDs).
		Find(&poItems).Error
	if err != nil {
		return nil, err
	}

	for _, item := range poItems {
		if item.PreOrderItemID != nil && item.PO != nil {
			result[*item.PreOrderItemID] = *item.PO
		}
	}
	return result, nil
}
