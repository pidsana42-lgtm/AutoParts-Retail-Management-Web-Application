package claim

import (
	"errors"

	"backend/internal/app/entity"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrClaimQuantityExceedsOrder = errors.New("claim must contain positive quantities of products from the sale, within the quantities sold")

func validateClaimQuantities(tx *gorm.DB, orderID uint, items []entity.CustomerClaimItem) error {
	if len(items) == 0 {
		return ErrClaimQuantityExceedsOrder
	}
	var sold []entity.SaleOrderItem
	if err := tx.Where("order_id = ?", orderID).Find(&sold).Error; err != nil {
		return err
	}
	remaining := make(map[uint]uint64)
	for _, item := range sold {
		if item.Qty > 0 {
			remaining[item.ProductID] += uint64(item.Qty)
		}
	}
	for _, item := range items {
		qty := uint64(item.Qty)
		if qty == 0 || qty > remaining[item.ProductID] {
			return ErrClaimQuantityExceedsOrder
		}
		remaining[item.ProductID] -= qty
	}
	return nil
}

// Serialize item additions/edits on their parent so the standalone endpoints
// cannot bypass the batch quantity check or race each other past the sold limit.
func (r *customerClaimRepository) saveValidatedClaimItem(item *entity.CustomerClaimItem, create bool) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var parent entity.CustomerClaim
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&parent, item.CustomerClaimID).Error; err != nil {
			return err
		}
		var siblings []entity.CustomerClaimItem
		if err := tx.Where("customer_claim_id = ? AND id <> ?", parent.ID, item.ID).Find(&siblings).Error; err != nil {
			return err
		}
		if err := validateClaimQuantities(tx, parent.OriginalOrderID, append(siblings, *item)); err != nil {
			return err
		}
		if create {
			return tx.Create(item).Error
		}
		return tx.Save(item).Error
	})
}

// UpdateCustomerClaimItemWithLock: ล็อกแถว item และ parent claim ไว้ตั้งแต่อ่านจนบันทึกเสร็จในทรานแซกชัน
// เดียวกัน — mutate จึงเห็นค่า flag (StockOutIssued/StockInReceived/CreditApplied) ที่เป็นปัจจุบันจริงเสมอ
// ต่อให้มีอีกคำขอกำลังแก้ไขรายการเดียวกันพร้อมกันอยู่ก็ตาม (คำขอที่สองจะรอจนคำขอแรก commit เสร็จก่อน แล้ว
// เห็นค่าที่คำขอแรกเพิ่งบันทึกไป ไม่ใช่ค่าเก่าก่อนหน้า)
func (r *customerClaimRepository) UpdateCustomerClaimItemWithLock(id uint, mutate func(item *entity.CustomerClaimItem) error) (*entity.CustomerClaimItem, error) {
	var item entity.CustomerClaimItem
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Product").First(&item, id).Error; err != nil {
			return err
		}
		if err := mutate(&item); err != nil {
			return err
		}
		var parent entity.CustomerClaim
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&parent, item.CustomerClaimID).Error; err != nil {
			return err
		}
		var siblings []entity.CustomerClaimItem
		if err := tx.Where("customer_claim_id = ? AND id <> ?", parent.ID, item.ID).Find(&siblings).Error; err != nil {
			return err
		}
		if err := validateClaimQuantities(tx, parent.OriginalOrderID, append(siblings, item)); err != nil {
			return err
		}
		return tx.Save(&item).Error
	})
	if err != nil {
		return nil, err
	}
	return &item, nil
}
