// Package preorderstock derives customer reservations from confirmed receipt lines.
// Purchase orders are only read; their contents and workflow are never updated here.
package preorderstock

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

func Receipts(db *gorm.DB) *gorm.DB {
	return db.Table("bill_items AS bi").
		Joins("JOIN bills b ON b.id = bi.bill_id AND b.deleted_at IS NULL").
		Where("bi.deleted_at IS NULL AND LOWER(b.payment_status) <> ?", "draft")
}

func Reserved(db *gorm.DB, productID uint, supplierID *uint) (int, error) {
	var qty int
	q := Receipts(db).
		Joins("JOIN pre_order_items pi ON pi.id = bi.pre_order_item_id AND pi.deleted_at IS NULL").
		Joins("JOIN pre_orders p ON p.id = pi.pre_order_id AND p.deleted_at IS NULL").
		Where("bi.product_id = ? AND p.status NOT IN ?", productID, []string{"CANCELLED", "COMPLETED"})
	if supplierID != nil {
		q = q.Where("b.supplier_id = ?", *supplierID)
	}
	err := q.Select("COALESCE(SUM(bi.order_quantity), 0)").Scan(&qty).Error
	return qty, err
}

func Populate(db *gorm.DB, orders []entity.PreOrder) error {
	var ids []uint
	for _, order := range orders {
		for _, item := range order.PreOrderItems {
			ids = append(ids, item.ID)
		}
	}
	if len(ids) == 0 {
		return nil
	}
	var rows []struct {
		PreOrderItemID uint
		Quantity       int
	}
	if err := Receipts(db).Where("bi.pre_order_item_id IN ?", ids).
		Select("bi.pre_order_item_id, SUM(bi.order_quantity) AS quantity").Group("bi.pre_order_item_id").Scan(&rows).Error; err != nil {
		return err
	}
	quantities := map[uint]int{}
	for _, row := range rows {
		quantities[row.PreOrderItemID] = row.Quantity
	}
	for i := range orders {
		for j := range orders[i].PreOrderItems {
			item := &orders[i].PreOrderItems[j]
			item.ReceivedQuantity = quantities[item.ID]
		}
	}
	return nil
}
