package claim

import (
	"backend/internal/app/entity"
	"errors"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrOrderInProgress = errors.New("sale order already has an active claim or return")

type CustomerClaimRepository interface {
	CreateCustomerClaim(claim *entity.CustomerClaim) error
	CreateCustomerClaimItem(item *entity.CustomerClaimItem) error
	GetCustomerClaimByID(id uint) (*entity.CustomerClaim, error)
	GetCustomerClaimItemByID(id uint) (*entity.CustomerClaimItem, error)
	ListCustomerClaims() ([]entity.CustomerClaim, error)
	UpdateCustomerClaim(claim *entity.CustomerClaim) error
	UpdateCustomerClaimItem(item *entity.CustomerClaimItem) error
	DeleteCustomerClaim(id uint) error
	GetCompanySetting() (*entity.CompanySetting, error)
	// AdjustProductStock: ปรับจำนวนสินค้าคงคลัง (delta ติดลบ = ตัดออก, บวก = เติมกลับ)
	// พร้อมบันทึกประวัติ StockMovement ไว้เป็นหลักฐานในคราวเดียวกันแบบ atomic
	AdjustProductStock(productID uint, delta int, movementType, note string) error
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
		return tx.Omit("Items").Create(claim).Error
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
	return r.db.Save(claim).Error
}

func (r *customerClaimRepository) UpdateCustomerClaimItem(item *entity.CustomerClaimItem) error {
	return r.saveValidatedClaimItem(item, false)
}

func (r *customerClaimRepository) DeleteCustomerClaim(id uint) error {
	return r.db.Delete(&entity.CustomerClaim{}, id).Error
}

func (r *customerClaimRepository) AdjustProductStock(productID uint, delta int, movementType, note string) error {
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
