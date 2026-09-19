package repository

import (
	"backend/internal/app/entity"
	"backend/internal/pkg/preorderstock"
	"fmt"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"strings"
	"time"
)

// Validate explicit receipt links. A product/name match alone never reserves stock.
func validateReceiptLinks(tx *gorm.DB, bill *entity.Bill, items []entity.BillItem) error {
	totals := map[uint]int{}
	preorderTotals := map[uint]int{}
	for i := range items {
		item := &items[i]
		if item.OrderQuantity < 0 {
			return fmt.Errorf("จำนวนรับเข้าต้องไม่ติดลบ")
		}
		if item.POItemID == nil {
			if item.PreOrderItemID != nil || bill.POID != nil {
				return fmt.Errorf("กรุณาเลือกรายการจากใบสั่งซื้ออีกครั้งเพื่อผูกการรับเข้าให้ถูกต้อง")
			}
			continue
		}
		if bill.POID == nil {
			return fmt.Errorf("รายการรับเข้าต้องระบุใบสั่งซื้ออ้างอิง")
		}
		var po entity.PO
		if err := tx.First(&po, *bill.POID).Error; err != nil {
			return err
		}
		if po.SupplierID != bill.SupplierID || string(po.Status) != "APPROVED" {
			return fmt.Errorf("ใบสั่งซื้อต้องอนุมัติแล้วและเป็นของบริษัทที่รับเข้า")
		}
		var source entity.POItems
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ? AND po_id = ?", *item.POItemID, po.ID).First(&source).Error; err != nil {
			return fmt.Errorf("ไม่พบรายการในใบสั่งซื้ออ้างอิง: %w", err)
		}
		if source.ProductID != nil && *source.ProductID != item.ProductID {
			return fmt.Errorf("สินค้ารับเข้าไม่ตรงกับรายการใบสั่งซื้อ")
		}
		if item.PreOrderItemID != nil && (source.PreOrderItemID == nil || *source.PreOrderItemID != *item.PreOrderItemID) {
			return fmt.Errorf("พรีออเดอร์ไม่ตรงกับรายการใบสั่งซื้อ")
		}
		item.PreOrderItemID = source.PreOrderItemID
		totals[source.ID] += item.OrderQuantity
		var prior int
		if err := preorderstock.Receipts(tx).Where("bi.po_item_id = ? AND bi.bill_id <> ?", source.ID, bill.ID).Select("COALESCE(SUM(bi.order_quantity),0)").Scan(&prior).Error; err != nil {
			return err
		}
		if !strings.EqualFold(bill.PaymentStatus, "draft") && float64(prior+totals[source.ID]) > source.Quantity {
			return fmt.Errorf("จำนวนรับเข้าสะสมเกินจำนวนสั่งซื้อของรายการ %d", source.ID)
		}
		if source.PreOrderItemID == nil {
			continue
		}
		var preItem entity.PreOrderItem
		if err := tx.First(&preItem, *source.PreOrderItemID).Error; err != nil {
			return err
		}
		var pre entity.PreOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&pre, preItem.PreOrderID).Error; err != nil {
			return err
		}
		if pre.Status == "CANCELLED" || pre.Status == "COMPLETED" {
			return fmt.Errorf("ไม่สามารถรับสินค้าให้พรีออเดอร์ที่ยกเลิกหรือส่งมอบแล้ว")
		}
		if preItem.ProductID != nil && item.ProductID != *preItem.ProductID {
			return fmt.Errorf("สินค้ารับเข้าไม่ตรงกับรายการพรีออเดอร์")
		}
		preorderTotals[preItem.ID] += item.OrderQuantity
		if err := preorderstock.Receipts(tx).Where("bi.pre_order_item_id = ? AND bi.bill_id <> ?", preItem.ID, bill.ID).Select("COALESCE(SUM(bi.order_quantity),0)").Scan(&prior).Error; err != nil {
			return err
		}
		if !strings.EqualFold(bill.PaymentStatus, "draft") && prior+preorderTotals[preItem.ID] > preItem.Quantity {
			return fmt.Errorf("จำนวนรับเข้าเกินจำนวนที่ลูกค้าจอง")
		}
	}
	return nil
}

func reverseReceiptStock(tx *gorm.DB, billID, supplierID uint) error {
	var bill entity.Bill
	if err := tx.Unscoped().First(&bill, billID).Error; err != nil {
		return err
	}
	var items []entity.BillItem
	if err := tx.Where("bill_id = ?", billID).Order("product_id, id").Find(&items).Error; err != nil {
		return err
	}
	// Delivered stock cannot be undone by editing/deleting its receipt.
	for _, item := range items {
		if item.PreOrderItemID != nil {
			var count int64
			if err := tx.Table("pre_order_items pi").Joins("JOIN pre_orders p ON p.id = pi.pre_order_id").Where("pi.id = ? AND p.status = ?", *item.PreOrderItemID, "COMPLETED").Count(&count).Error; err != nil {
				return err
			}
			if count > 0 {
				return fmt.Errorf("ไม่สามารถแก้ไขหรือลบบิลที่ส่งมอบสินค้าพรีออเดอร์แล้ว")
			}
		}
	}
	if err := tx.Where("bill_id = ?", billID).Delete(&entity.BillItem{}).Error; err != nil {
		return err
	}
	if strings.EqualFold(bill.PaymentStatus, "draft") {
		return nil
	}
	for _, item := range items {
		if item.ProductID == 0 || item.OrderQuantity <= 0 {
			continue
		}
		var product entity.Product
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, item.ProductID).Error; err != nil {
			return err
		}
		reserved, err := preorderstock.Reserved(tx, item.ProductID, nil)
		if err != nil {
			return err
		}
		if product.Quantity-item.OrderQuantity < reserved {
			return fmt.Errorf("ไม่สามารถย้อนรับเข้าได้ ยอดที่เหลือต้องกันไว้ให้พรีออเดอร์อื่น")
		}
		result := tx.Model(&entity.Product{}).Where("id = ? AND quantity >= ?", item.ProductID, item.OrderQuantity).UpdateColumn("quantity", gorm.Expr("quantity - ?", item.OrderQuantity))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("ไม่สามารถย้อนรับเข้าได้ สินค้าถูกใช้ไปแล้ว")
		}
		supplierReserved, err := preorderstock.Reserved(tx, item.ProductID, &supplierID)
		if err != nil {
			return err
		}
		result = tx.Model(&entity.Inventory{}).Where("product_id = ? AND supplier_id = ? AND inventory_quantity >= ?", item.ProductID, supplierID, item.OrderQuantity+supplierReserved).Updates(map[string]interface{}{"inventory_quantity": gorm.Expr("inventory_quantity - ?", item.OrderQuantity), "last_updated_date_time": time.Now()})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != 1 {
			return fmt.Errorf("ยอดสินค้าของบริษัทไม่พอสำหรับย้อนรับเข้า")
		}
	}
	return tx.Unscoped().Where("bill_id = ?", billID).Delete(&entity.StockMovement{}).Error
}

// Metadata/price approval must still work after some received units have been sold.
// When stock ownership and quantities are identical, retain the original stock movement.
func receiptStockUnchanged(tx *gorm.DB, old, next *entity.Bill, items []entity.BillItem) (bool, error) {
	if old.DeletedAt.Valid || old.SupplierID != next.SupplierID || strings.EqualFold(old.PaymentStatus, "draft") != strings.EqualFold(next.PaymentStatus, "draft") {
		return false, nil
	}
	var previous []entity.BillItem
	if err := tx.Where("bill_id = ?", old.ID).Find(&previous).Error; err != nil {
		return false, err
	}
	key := func(item entity.BillItem) string {
		var poID, preID uint
		if item.POItemID != nil {
			poID = *item.POItemID
		}
		if item.PreOrderItemID != nil {
			preID = *item.PreOrderItemID
		}
		return fmt.Sprintf("%d/%d/%d", item.ProductID, poID, preID)
	}
	totals := map[string]int{}
	for _, item := range previous {
		totals[key(item)] += item.OrderQuantity
	}
	for _, item := range items {
		if item.ProductID == 0 {
			return false, nil
		}
		totals[key(item)] -= item.OrderQuantity
	}
	for _, qty := range totals {
		if qty != 0 {
			return false, nil
		}
	}
	return true, nil
}
