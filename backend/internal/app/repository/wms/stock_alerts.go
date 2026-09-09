package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type ActivePOInfo struct {
	POID      uint
	PONumber  string
	POCount   int
	PONumbers []string
}

type StockAlertRepository interface {
	Create(sa *entity.StockAlert) error
	GetByID(id uint) (*entity.StockAlert, error)
	List(isResolved string) ([]entity.StockAlert, error)
	Update(sa *entity.StockAlert) error
	ResolveByIDs(ids []uint) error
	GetActivePOAlertMap(alertIDs []uint) (map[uint]ActivePOInfo, error)

	// ListLowStockProducts: สินค้าที่คงเหลือ <= จุดสั่งซื้อที่ตั้งไว้จริง (limit_quantity > 0) — ใช้เป็นแหล่งตรวจจับ
	// ให้ cron สร้าง StockAlert อัตโนมัติ (ดู service.CheckAndCreateAlerts / cron.StartLowStockCron)
	ListLowStockProducts() ([]entity.Product, error)
	// ListUnresolvedAlertProductIDs: product id ที่มี alert ค้างอยู่ (ยังไม่ resolved) แล้ว — กันสร้างซ้ำซ้อนทุกรอบที่ cron รัน
	ListUnresolvedAlertProductIDs() (map[uint]bool, error)
}

type stockAlertRepository struct {
	db *gorm.DB
}

func NewStockAlertRepository(db *gorm.DB) StockAlertRepository {
	return &stockAlertRepository{db: db}
}

func (r *stockAlertRepository) Create(sa *entity.StockAlert) error {
	return r.db.Create(sa).Error
}

func (r *stockAlertRepository) GetByID(id uint) (*entity.StockAlert, error) {
	var sa entity.StockAlert
	err := r.db.Preload("Product").First(&sa, id).Error
	if err != nil {
		return nil, err
	}
	return &sa, nil
}

func (r *stockAlertRepository) List(isResolved string) ([]entity.StockAlert, error) {
	var list []entity.StockAlert
	query := r.db.
		Preload("Product").
		Preload("Product.Unit").
		Preload("Product.Inventories", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, product_id, supplier_id").Order("id desc")
		}).
		Preload("Product.Inventories.Supplier", func(db *gorm.DB) *gorm.DB {
			return db.Select("id, supplier_name")
		})
	if isResolved != "" {
		query = query.Where("is_resolved = ?", isResolved)
	}
	return list, query.Order("created_at desc").Find(&list).Error
}

func (r *stockAlertRepository) Update(sa *entity.StockAlert) error {
	return r.db.Save(sa).Error
}

func (r *stockAlertRepository) ResolveByIDs(ids []uint) error {
	if len(ids) == 0 {
		return nil
	}
	return r.db.Model(&entity.StockAlert{}).
		Where("id IN ?", ids).
		Update("is_resolved", "true").Error
}

func (r *stockAlertRepository) GetActivePOAlertMap(alertIDs []uint) (map[uint]ActivePOInfo, error) {
	if len(alertIDs) == 0 {
		return map[uint]ActivePOInfo{}, nil
	}

	type Result struct {
		AlertID  uint   `gorm:"column:alert_id"`
		POID     uint   `gorm:"column:po_id"`
		PONumber string `gorm:"column:po_number"`
	}

	var rows []Result
	err := r.db.Table("purchase_order_items poi").
		Select("poi.alert_id, po.id as po_id, po.po_number").
		Joins("JOIN purchase_orders po ON po.id = poi.po_id").
		Where("poi.alert_id IN ? AND poi.deleted_at IS NULL AND po.deleted_at IS NULL AND po.status NOT IN ('CANCELLED', 'DELETED')", alertIDs).
		Order("po.id DESC").
		Scan(&rows).Error

	if err != nil {
		return nil, err
	}

	resultMap := make(map[uint]ActivePOInfo)
	for _, row := range rows {
		if existing, exists := resultMap[row.AlertID]; !exists {
			resultMap[row.AlertID] = ActivePOInfo{
				POID:      row.POID,
				PONumber:  row.PONumber,
				POCount:   1,
				PONumbers: []string{row.PONumber},
			}
		} else {
			found := false
			for _, num := range existing.PONumbers {
				if num == row.PONumber {
					found = true
					break
				}
			}
			if !found {
				existing.POCount++
				existing.PONumbers = append(existing.PONumbers, row.PONumber)
				resultMap[row.AlertID] = existing
			}
		}
	}
	return resultMap, nil
}

func (r *stockAlertRepository) ListLowStockProducts() ([]entity.Product, error) {
	var list []entity.Product
	err := r.db.
		Where("limit_quantity > 0 AND quantity <= limit_quantity").
		Find(&list).Error
	return list, err
}

func (r *stockAlertRepository) ListUnresolvedAlertProductIDs() (map[uint]bool, error) {
	var productIDs []uint
	err := r.db.Model(&entity.StockAlert{}).
		Where("is_resolved = ? AND product_id IS NOT NULL", "false").
		Pluck("product_id", &productIDs).Error
	if err != nil {
		return nil, err
	}
	result := make(map[uint]bool, len(productIDs))
	for _, id := range productIDs {
		result[id] = true
	}
	return result, nil
}
