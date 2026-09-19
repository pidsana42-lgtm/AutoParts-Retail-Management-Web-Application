package pre_oder

import (
	"backend/internal/app/entity"
	"backend/internal/pkg/preorderstock"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"time"
)

// Preserve the IDs used by existing PO and receipt lines when editing a booking.
func protectLinkedItems(tx *gorm.DB, updated *entity.PreOrder) (bool, error) {
	var old entity.PreOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("PreOrderItems").First(&old, updated.ID).Error; err != nil {
		return false, err
	}
	if old.Status == "COMPLETED" {
		return false, fmt.Errorf("พรีออเดอร์ส่งมอบแล้ว ไม่สามารถแก้ไขได้")
	}
	headerChanged := old.CustomerID != updated.CustomerID || old.SupplierID != updated.SupplierID || old.PreOrderType != updated.PreOrderType || old.DepositAmount != updated.DepositAmount || !old.OrderDate.Equal(updated.OrderDate)
	if headerChanged && old.Status != "PENDING" && old.Status != "PO_PENDING" && old.Status != "PO_DRAFT" {
		return false, fmt.Errorf("แก้ไขใบสั่งจองได้เฉพาะรายการที่ยังไม่อนุมัติและยังไม่ปิดรายการ")
	}
	var count int64
	if err := tx.Model(&entity.POItems{}).Where("pre_order_item_id IN (?)", tx.Model(&entity.PreOrderItem{}).Select("id").Where("pre_order_id = ?", old.ID)).Count(&count).Error; err != nil {
		return false, err
	}
	if count == 0 {
		return false, nil
	}
	if len(old.PreOrderItems) != len(updated.PreOrderItems) {
		return false, fmt.Errorf("รายการถูกส่งไปสั่งซื้อแล้ว ไม่สามารถเพิ่มหรือลบรายการได้")
	}
	for i, before := range old.PreOrderItems {
		after := updated.PreOrderItems[i]
		sameProduct := (before.ProductID == nil && after.ProductID == nil) || (before.ProductID != nil && after.ProductID != nil && *before.ProductID == *after.ProductID)
		if !sameProduct || before.Quantity != after.Quantity || before.ProductNameSnapshot != after.ProductNameSnapshot || before.ProductCodeSnapshot != after.ProductCodeSnapshot || before.SupplierPartCode != after.SupplierPartCode || before.UnitPrice != after.UnitPrice {
			return false, fmt.Errorf("รายการถูกส่งไปสั่งซื้อแล้ว ไม่สามารถแก้สินค้า จำนวน หรือราคาได้")
		}
	}
	if headerChanged {
		var approved int64
		if err := tx.Model(&entity.POItems{}).
			Joins("JOIN purchase_orders po ON po.id = purchase_order_items.po_id AND po.deleted_at IS NULL").
			Where("purchase_order_items.pre_order_item_id IN (?)", tx.Model(&entity.PreOrderItem{}).Select("id").Where("pre_order_id = ?", old.ID)).
			Where("po.status = ? OR po.approved_at IS NOT NULL", "APPROVED").Count(&approved).Error; err != nil {
			return false, err
		}
		if approved > 0 {
			return false, fmt.Errorf("ใบสั่งจองได้รับอนุมัติแล้ว ไม่สามารถแก้ไขได้")
		}
	}
	updated.PreOrderItems = old.PreOrderItems
	if updated.Status == "READY" || updated.Status == "PARTIALLY_RECEIVED" {
		updated.Status = old.Status
	}
	if old.Status == "CANCELLED" && updated.Status != "CANCELLED" {
		return false, fmt.Errorf("ไม่สามารถเปิดพรีออเดอร์ที่ยกเลิกแล้วอีกครั้ง")
	}
	if updated.Status == "COMPLETED" {
		orders := []entity.PreOrder{old}
		if err := preorderstock.Populate(tx, orders); err != nil {
			return false, err
		}
		for _, item := range orders[0].PreOrderItems {
			if item.ReceivedQuantity < item.Quantity {
				return false, fmt.Errorf("ต้องรับสินค้าครบทุกรายการก่อนส่งมอบ")
			}
		}
		var receipts []struct {
			ProductID  uint
			SupplierID uint
			Quantity   int
		}
		if err := preorderstock.Receipts(tx).Joins("JOIN pre_order_items pi ON pi.id = bi.pre_order_item_id").Where("pi.pre_order_id = ?", old.ID).
			Select("bi.product_id, b.supplier_id, SUM(bi.order_quantity) AS quantity").Group("bi.product_id, b.supplier_id").Order("bi.product_id, b.supplier_id").Scan(&receipts).Error; err != nil {
			return false, err
		}
		for _, row := range receipts {
			var product entity.Product
			if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, row.ProductID).Error; err != nil {
				return false, err
			}
			result := tx.Model(&entity.Product{}).Where("id = ? AND quantity >= ?", row.ProductID, row.Quantity).UpdateColumn("quantity", gorm.Expr("quantity - ?", row.Quantity))
			if result.Error != nil {
				return false, result.Error
			}
			if result.RowsAffected != 1 {
				return false, fmt.Errorf("สต็อกจริงไม่พอส่งมอบ")
			}
			result = tx.Model(&entity.Inventory{}).Where("product_id = ? AND supplier_id = ? AND inventory_quantity >= ?", row.ProductID, row.SupplierID, row.Quantity).UpdateColumn("inventory_quantity", gorm.Expr("inventory_quantity - ?", row.Quantity))
			if result.Error != nil {
				return false, result.Error
			}
			if result.RowsAffected != 1 {
				return false, fmt.Errorf("สต็อกบริษัทไม่พอส่งมอบ")
			}
			if err := tx.Create(&entity.StockMovement{Movement_Type: "OUT", Quantity: row.Quantity, Movement_DateTime: time.Now(), ProductID: row.ProductID, SupplierID: &row.SupplierID, Note: fmt.Sprintf("ส่งมอบพรีออเดอร์ PRE-%05d", old.ID)}).Error; err != nil {
				return false, err
			}
		}
	}
	return true, nil
}
