package claim

import (
	"backend/internal/app/entity"
	"errors"
	"sort"
	"strings"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrOrderInProgress = errors.New("sale order already has an active claim or return")

// ErrClaimAlreadyAdjusted: ห้ามลบใบเคลมที่มีรายการซึ่งตัด/เติมสต็อกจริง หรือหักหนี้บัญชีเชื่อไปแล้ว
// เพราะการลบจะทำให้ผลข้างเคียงที่เกิดขึ้นจริงกับสต็อก/หนี้ลูกค้ากลายเป็นไม่มีหลักฐานอธิบายที่มาอีกต่อไป
var ErrClaimAlreadyAdjusted = errors.New("cannot delete a claim that already adjusted stock or customer debt")

// ErrClaimAlreadyCancelled/ErrClaimNotApproved: กันการยกเลิกซ้ำ และกันยกเลิกใบเคลมที่ยังไม่เคยอนุมัติ
// (รายการที่ยัง PENDING/REJECTED ไม่เคยตัดสต็อก/หักหนี้จริง ให้ใช้ปุ่มลบแทน ไม่ใช่ยกเลิก)
var ErrClaimAlreadyCancelled = errors.New("ใบเคลมนี้ถูกยกเลิกไปแล้ว")
var ErrClaimNotApproved = errors.New("ยกเลิกได้เฉพาะใบเคลมที่อนุมัติแล้วเท่านั้น")

type CustomerClaimRepository interface {
	CreateCustomerClaim(claim *entity.CustomerClaim) error
	CreateCustomerClaimItem(item *entity.CustomerClaimItem) error
	GetCustomerClaimByID(id uint) (*entity.CustomerClaim, error)
	GetCustomerClaimItemByID(id uint) (*entity.CustomerClaimItem, error)
	ListCustomerClaims() ([]entity.CustomerClaim, error)
	UpdateCustomerClaim(claim *entity.CustomerClaim) error
	UpdateCustomerClaimItem(item *entity.CustomerClaimItem) error
	// UpdateCustomerClaimItemWithLock: อ่านแถวล่าสุดจริงจาก DB พร้อมล็อกไว้ (SELECT ... FOR UPDATE)
	// ก่อนให้ mutate ตัดสินใจแก้ไข แล้วบันทึกในทรานแซกชันเดียวกันตลอด — กันไม่ให้ 2 คำขอที่มาพร้อมกัน
	// (เช่น กดอนุมัติซ้ำเร็วๆ) อ่านเห็นค่า flag เก่าคนละชุดแล้วต่างฝ่ายต่างตัดสินใจ apply ผลข้างเคียงซ้ำ
	UpdateCustomerClaimItemWithLock(id uint, mutate func(item *entity.CustomerClaimItem) error) (*entity.CustomerClaimItem, error)
	DeleteCustomerClaim(id uint) error
	GetCompanySetting() (*entity.CompanySetting, error)
	// AdjustProductStock: ปรับจำนวนสินค้าคงคลัง (delta ติดลบ = ตัดออก, บวก = เติมกลับ)
	// พร้อมบันทึกประวัติ StockMovement ไว้เป็นหลักฐานในคราวเดียวกันแบบ atomic
	// claimID: ใช้ย้อนหาออเดอร์ต้นทางของใบเคลม เพื่อเทียบว่าสินค้าตัวนี้เคยขายออกจาก Supplier ไหน (ถ้ารู้)
	// จะได้ปรับ Inventory ต่อ Supplier ให้ตรงกับ Product.Quantity รวมไปด้วย ไม่ใช่ปรับแค่ยอดรวมอย่างเดียว
	// (ส่ง 0 ได้ถ้าไม่มีใบเคลมอ้างอิง — จะข้ามการปรับ Inventory ต่อ Supplier ไปเฉยๆ ไม่ error)
	AdjustProductStock(productID uint, delta int, movementType, note string, claimID uint) error
	// ReduceCustomerDebtForClaim: หักยอดหนี้ค้างชำระ (บัญชีเชื่อ) ของลูกค้าเจ้าของ order ต้นทางของใบเคลม
	// amount ต้องเป็นค่าบวก และยอดหนี้จะไม่ถูกหักต่ำกว่า 0
	ReduceCustomerDebtForClaim(claimID uint, amount float64) error
	// IncreaseCustomerDebtForClaim: คืนยอดหนี้ค้างชำระที่เคยหักไปจากรายการเคลม (ใช้ตอนยกเลิก/ตีกลับ)
	IncreaseCustomerDebtForClaim(claimID uint, amount float64) error
	// CancelCustomerClaim: ยกเลิกใบเคลมที่อนุมัติแล้ว คืนสถานะรายการทั้งหมดเป็น CANCELLED และรีเซ็ต
	// flag การตัด/เติมสต็อก+หักหนี้ทั้งหมดกลับเป็น false ในทรานแซกชันเดียว แล้วคืนรายการ "ก่อนรีเซ็ต"
	// กลับไปให้ service ใช้ตัดสินใจว่าต้องคืนสต็อก/หนี้จริงเท่าไหร่ (นอกทรานแซกชันนี้ เหมือน apply* เดิม)
	CancelCustomerClaim(id uint) ([]entity.CustomerClaimItem, error)
}

type customerClaimRepository struct {
	db *gorm.DB
}

func NewCustomerClaimRepository(db *gorm.DB) CustomerClaimRepository {
	return &customerClaimRepository{db: db}
}

func (r *customerClaimRepository) CreateCustomerClaim(claim *entity.CustomerClaim) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var order entity.SaleOrder
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&order, claim.OriginalOrderID).Error; err != nil {
			return err
		}
		if err := validateClaimQuantities(tx, order.ID, claim.Items); err != nil {
			return err
		}

		var activeReturns int64
		if err := tx.Model(&entity.SalesReturn{}).
			Where("original_order_id = ? AND deleted_at IS NULL AND LOWER(TRIM(COALESCE(status, ''))) <> 'rejected'", claim.OriginalOrderID).
			Count(&activeReturns).Error; err != nil {
			return err
		}
		var activeClaims int64
		if err := tx.Model(&entity.CustomerClaim{}).
			Where("original_order_id = ? AND deleted_at IS NULL AND LOWER(TRIM(COALESCE(status, ''))) <> 'rejected'", claim.OriginalOrderID).
			Count(&activeClaims).Error; err != nil {
			return err
		}
		if activeReturns > 0 || activeClaims > 0 {
			return ErrOrderInProgress
		}

		// The service saves each item with its stock flags after this validation.
		if err := tx.Omit("Items").Create(claim).Error; err != nil {
			return err
		}

		claimStatus := strings.ToUpper(strings.TrimSpace(claim.Status))
		orderStatus := "CLAIM_IN_PROGRESS"
		if claimStatus == "APPROVED" {
			orderStatus = "CLAIMED"
		}
		return tx.Model(&entity.SaleOrder{}).Where("id = ?", claim.OriginalOrderID).Update("status", orderStatus).Error
	})
}

func (r *customerClaimRepository) CreateCustomerClaimItem(item *entity.CustomerClaimItem) error {
	return r.saveValidatedClaimItem(item, true)
}

func (r *customerClaimRepository) GetCustomerClaimByID(id uint) (*entity.CustomerClaim, error) {
	var claim entity.CustomerClaim
	err := r.db.Preload("OriginalOrder").
		Preload("OriginalOrder.Customer").
		Preload("Return").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Preload("Items").
		Preload("Items.Product").
		First(&claim, id).Error
	if err != nil {
		return nil, err
	}
	return &claim, nil
}

func (r *customerClaimRepository) ListCustomerClaims() ([]entity.CustomerClaim, error) {
	claims := make([]entity.CustomerClaim, 0)
	err := r.db.Preload("OriginalOrder").
		Preload("OriginalOrder.Customer").
		Preload("Return").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Preload("Items").
		Preload("Items.Product").
		Find(&claims).Error
	return claims, err
}

func (r *customerClaimRepository) GetCustomerClaimItemByID(id uint) (*entity.CustomerClaimItem, error) {
	var item entity.CustomerClaimItem
	err := r.db.Preload("Product").First(&item, id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *customerClaimRepository) UpdateCustomerClaim(claim *entity.CustomerClaim) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(claim).Error; err != nil {
			return err
		}
		claimStatus := strings.ToUpper(strings.TrimSpace(claim.Status))
		if claimStatus == "APPROVED" {
			_ = tx.Model(&entity.SaleOrder{}).Where("id = ?", claim.OriginalOrderID).Update("status", "CLAIMED").Error
		} else if claimStatus == "REJECTED" || claimStatus == "CANCELLED" {
			_ = tx.Model(&entity.SaleOrder{}).Where("id = ?", claim.OriginalOrderID).Update("status", "completed").Error
		}
		return nil
	})
}

func (r *customerClaimRepository) UpdateCustomerClaimItem(item *entity.CustomerClaimItem) error {
	return r.saveValidatedClaimItem(item, false)
}

func (r *customerClaimRepository) DeleteCustomerClaim(id uint) error {
	var claim entity.CustomerClaim
	if err := r.db.First(&claim, id).Error; err != nil {
		return err
	}
	// ใบเคลมที่ถูกยกเลิกแล้วต้องเก็บไว้เป็นประวัติ (เคยอนุมัติจริงมาก่อน) ห้ามลบทิ้งแม้ flag
	// ตัด/เติมสต็อก+หักหนี้จะถูกรีเซ็ตเป็น false หมดแล้วตอนยกเลิกก็ตาม
	if strings.ToUpper(strings.TrimSpace(claim.Status)) == "CANCELLED" {
		return ErrClaimAlreadyCancelled
	}
	var adjustedCount int64
	if err := r.db.Model(&entity.CustomerClaimItem{}).
		Where("customer_claim_id = ? AND (stock_out_issued = ? OR stock_in_received = ? OR credit_applied = ?)", id, true, true, true).
		Count(&adjustedCount).Error; err != nil {
		return err
	}
	if adjustedCount > 0 {
		return ErrClaimAlreadyAdjusted
	}
	if err := r.db.Delete(&entity.CustomerClaim{}, id).Error; err != nil {
		return err
	}
	// คืนสถานะบิลขายกลับเป็น completed
	return r.db.Model(&entity.SaleOrder{}).Where("id = ?", claim.OriginalOrderID).Update("status", "completed").Error
}

func (r *customerClaimRepository) CancelCustomerClaim(id uint) ([]entity.CustomerClaimItem, error) {
	var itemsBefore []entity.CustomerClaimItem
	err := r.db.Transaction(func(tx *gorm.DB) error {
		var claim entity.CustomerClaim
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&claim, id).Error; err != nil {
			return err
		}
		statusUp := strings.ToUpper(strings.TrimSpace(claim.Status))
		if statusUp == "CANCELLED" {
			return ErrClaimAlreadyCancelled
		}
		if statusUp != "APPROVED" {
			return ErrClaimNotApproved
		}

		var items []entity.CustomerClaimItem
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("customer_claim_id = ?", id).Find(&items).Error; err != nil {
			return err
		}
		itemsBefore = make([]entity.CustomerClaimItem, len(items))
		copy(itemsBefore, items)

		for i := range items {
			items[i].Status = "CANCELLED"
			items[i].StockOutIssued = false
			items[i].StockInReceived = false
			items[i].CreditApplied = false
			if err := tx.Save(&items[i]).Error; err != nil {
				return err
			}
		}
		claim.Status = "CANCELLED"
		if err := tx.Save(&claim).Error; err != nil {
			return err
		}
		// คืนสถานะบิลขายกลับเป็น completed
		return tx.Model(&entity.SaleOrder{}).Where("id = ?", claim.OriginalOrderID).Update("status", "completed").Error
	})
	if err != nil {
		return nil, err
	}
	return itemsBefore, nil
}

func (r *customerClaimRepository) AdjustProductStock(productID uint, delta int, movementType, note string, claimID uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&entity.Product{}).
			Where("id = ?", productID).
			UpdateColumn("quantity", gorm.Expr("quantity + ?", delta))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}

		// นอกจากปรับ Product.Quantity รวมแล้ว พยายามปรับ Inventory ต่อ Supplier ให้ตรงกันไปด้วย โดยย้อนไปดูว่า
		// สินค้าตัวนี้เคยขายออกจาก Supplier ไหนในออเดอร์ต้นทางของใบเคลมนี้ (ถ้ารู้) — หาไม่เจอ/ไม่ทราบ Supplier
		// ก็แค่ข้ามส่วนนี้ไปเงียบๆ ไม่ทำให้การปรับสต็อกหลัก (ซึ่งสำคัญกว่า) ล้มเหลวไปด้วย
		if claimID != 0 {
			var claim entity.CustomerClaim
			if err := tx.Select("id", "original_order_id").First(&claim, claimID).Error; err == nil {
				var soldItems []entity.SaleOrderItem
				if err := tx.Where("order_id = ? AND product_id = ?", claim.OriginalOrderID, productID).
					Find(&soldItems).Error; err == nil {
					absQty := delta
					if absQty < 0 {
						absQty = -absQty
					}
					for supplierID, qty := range allocateClaimSupplierAdjustments(soldItems, absQty) {
						adjDelta := qty
						if delta < 0 {
							adjDelta = -qty
						}
						if err := adjustSupplierInventory(tx, productID, supplierID, adjDelta); err != nil {
							return err
						}
					}
				}
			}
		}

		qty := delta
		if qty < 0 {
			qty = -qty
		}
		movement := &entity.StockMovement{
			Movement_Type:     movementType,
			Quantity:          qty,
			Movement_DateTime: time.Now(),
			Note:              note,
			ProductID:         productID,
		}
		return tx.Create(movement).Error
	})
}

// allocateClaimSupplierAdjustments: จับคู่จำนวนที่เคลม (จ่ายออก/รับเข้า/ตีกลับ) ของสินค้าตัวหนึ่ง กลับไปยัง
// Supplier lot เดิมที่เคยขายออกไปในออเดอร์ต้นทางของใบเคลมนี้ (อ้างอิงจาก SaleOrderItem.SupplierID) — จับคู่ตาม
// ลำดับ SaleOrderItem.ID และปรับได้ไม่เกินจำนวนที่แถวนั้นเคยขายจริง แถวไหนไม่ทราบ Supplier (ขายแบบทั่วไป ไม่ได้
// ระบุล็อต) ส่วนนั้นจะไม่ถูกจับคู่เข้า Inventory ที่นี่ (Product.Quantity ยังถูกปรับครบตามเดิมอยู่แล้วนอกฟังก์ชันนี้)
func allocateClaimSupplierAdjustments(soldItems []entity.SaleOrderItem, absQty int) map[uint]int {
	adjustments := make(map[uint]int)
	if absQty <= 0 {
		return adjustments
	}

	candidates := make([]entity.SaleOrderItem, 0, len(soldItems))
	for _, si := range soldItems {
		if si.SupplierID != nil {
			candidates = append(candidates, si)
		}
	}
	sort.Slice(candidates, func(i, j int) bool { return candidates[i].ID < candidates[j].ID })

	remaining := absQty
	for _, si := range candidates {
		if remaining <= 0 {
			break
		}
		take := si.Qty
		if take > remaining {
			take = remaining
		}
		if take <= 0 {
			continue
		}
		adjustments[*si.SupplierID] += take
		remaining -= take
	}
	return adjustments
}

// adjustSupplierInventory: ปรับจำนวนของ Supplier รายนั้นสำหรับสินค้าตัวนี้ (delta ติดลบ = ตัดออก บวก = เติมกลับ)
// กันไม่ให้ติดลบ (floor ที่ 0) เหมือนกับที่ฝั่ง POS ทำตอนขาย/แก้ไขออเดอร์ — ถ้าไม่พบแถว Inventory (เช่นถูกลบไป
// หลังขาย) ข้ามไปเงียบๆ เช่นกัน
func adjustSupplierInventory(tx *gorm.DB, productID, supplierID uint, delta int) error {
	if delta == 0 {
		return nil
	}
	var inv entity.Inventory
	if err := tx.Where("product_id = ? AND supplier_id = ?", productID, supplierID).First(&inv).Error; err != nil {
		return nil
	}
	newQty := inv.Inventory_Quantity + delta
	if newQty < 0 {
		newQty = 0
	}
	return tx.Model(&entity.Inventory{}).Where("id = ?", inv.ID).Update("inventory_quantity", newQty).Error
}

func (r *customerClaimRepository) ReduceCustomerDebtForClaim(claimID uint, amount float64) error {
	if amount <= 0 {
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		var claim entity.CustomerClaim
		if err := tx.First(&claim, claimID).Error; err != nil {
			return err
		}
		var order entity.SaleOrder
		if err := tx.First(&order, claim.OriginalOrderID).Error; err != nil {
			return err
		}
		if order.CustomerID == nil {
			return nil
		}
		result := tx.Model(&entity.Customer{}).
			Where("id = ?", *order.CustomerID).
			UpdateColumn("current_debt_amount", gorm.Expr("GREATEST(current_debt_amount - ?, 0)", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *customerClaimRepository) IncreaseCustomerDebtForClaim(claimID uint, amount float64) error {
	if amount <= 0 {
		return nil
	}
	return r.db.Transaction(func(tx *gorm.DB) error {
		var claim entity.CustomerClaim
		if err := tx.First(&claim, claimID).Error; err != nil {
			return err
		}
		var order entity.SaleOrder
		if err := tx.First(&order, claim.OriginalOrderID).Error; err != nil {
			return err
		}
		if order.CustomerID == nil {
			return nil
		}
		result := tx.Model(&entity.Customer{}).
			Where("id = ?", *order.CustomerID).
			UpdateColumn("current_debt_amount", gorm.Expr("current_debt_amount + ?", amount))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return gorm.ErrRecordNotFound
		}
		return nil
	})
}

func (r *customerClaimRepository) GetCompanySetting() (*entity.CompanySetting, error) {
	var setting entity.CompanySetting
	if err := r.db.First(&setting).Error; err != nil {
		// Fallback default setting if table is empty
		return &entity.CompanySetting{
			CompanyName: "AutoParts Retail Management",
			Address:     "123 ถนนมิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000",
			PhoneNumber: "043-123456",
			Email:       "contact@autoparts.com",
			TaxIDNumber: "0105559999999",
		}, nil
	}
	return &setting, nil
}
