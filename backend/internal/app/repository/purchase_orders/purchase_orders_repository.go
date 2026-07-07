package purchaseorders

import (
	"fmt"
	"time"
	"errors"
	"context"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
	poDto "backend/internal/app/dto/purchase_orders"
)

// PurchaseOrderRepository คุมตาราง purchase_orders และ po_items
type PurchaseOrderRepository interface {
	GetLatestPONumberByYear(ctx context.Context, year string) (string, error)
	SavePO(ctx context.Context, po *poEntity.PO) error
	FindAll(ctx context.Context, userID uint, query poDto.ListPOQuery) ([]poEntity.PO, int64, error)
	DeletePOByID(ctx context.Context, id uint) error
	GetPOByID(ctx context.Context, id uint) (*poEntity.PO, error)
	GetPOForPDF(ctx context.Context, id uint) (*poEntity.PO, error)
	GetPOSummary(ctx context.Context, userID uint) (*poDto.POSummaryResponse, error)
	// UpdatePDF(ctx context.Context, id uint, url string) error
}

type purchaseOrderRepository struct {
	db *gorm.DB
}

// NewPurchaseOrderRepository ใช้สำหรับส่ง gorm.DB เข้ามาตอนเริ่มระบบ
func NewPORepository(db *gorm.DB) PurchaseOrderRepository {
	return &purchaseOrderRepository{
		db: db,
	}
}

// ค้นหา PO_NUMBER ล่าสุด
func (r *purchaseOrderRepository) GetLatestPONumberByYear(ctx context.Context, year string) (string, error) {
	var lastPO poEntity.PO
	prefix := fmt.Sprintf("PO-%s-", year)

	// ค้นหา PO ที่ขึ้นต้นด้วย "PO-YYYY-" และเรียงจากล่าสุด (id desc)
	err := r.db.WithContext(ctx).
		Where("po_number LIKE ?", prefix+"%").
		Order("id desc").
		First(&lastPO).Error

	if err != nil {
		// ถ้าหาไม่เจอเลย แปลว่าเป็นบิลใบแรกของปี
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil 
		}
		return "", err
	}

	return lastPO.PO_number, nil
}

// Save บันทึกใบสั่งซื้อพร้อมไอเทมลูกทั้งหมดลง Database (มีระบบ Transaction ป้องกันข้อมูลพัง)
func (r *purchaseOrderRepository) SavePO(ctx context.Context, po *poEntity.PO) error {
    return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        // บันทึก PO ก่อน
        if err := tx.Create(po).Error; err != nil {
            return err
        }

        return nil
    })
}

func (r *purchaseOrderRepository) FindAll(ctx context.Context, userID uint, query poDto.ListPOQuery) ([]poEntity.PO, int64, error) {
	var po []poEntity.PO
	var total int64

	dbQuery := r.db.WithContext(ctx).Model(&poEntity.PO{}).Where("created_by = ?", userID)

	// Filter Status
	if query.Status != "" {
		dbQuery = dbQuery.Where("status = ?", query.Status)
	}
	// Filter Search
	if query.Search != "" {
		dbQuery = dbQuery.Where("po_number LIKE ?", "%"+query.Search+"%")
	}
	// Filter Date
	if query.Date != "" {
		dbQuery = dbQuery.Where("DATE(created_at) = ?", query.Date)
	}
	// Count
	if err := dbQuery.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (query.Page - 1) * query.Limit
	err := dbQuery.
		Preload("Creator").
		Preload("Supplier").
		Preload("PO_Items").
		Preload("PO_Items.Alert").
        Preload("PO_Items.PreOrderItem").
		Order("created_at DESC").
		Offset(offset).
		Limit(query.Limit).
		Find(&po).Error

	return po, total, err
}

func (r *purchaseOrderRepository) GetPOSummary(ctx context.Context, userID uint) (*poDto.POSummaryResponse, error) {
	var summary poDto.POSummaryResponse

	// หาวันที่ 1 ของเดือนปัจจุบัน (สำหรับ MTD)
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	// 1. Query ยอดรออนุมัติ
	r.db.WithContext(ctx).Model(&poEntity.PO{}). 
		Where("created_by = ? AND UPPER(status) = ?", userID, "PENDING").
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&summary.PendingAmount)

	// 2. Query ยอดอนุมัติแล้ว (MTD)
	r.db.WithContext(ctx).Model(&poEntity.PO{}).
		Where("created_by = ? AND UPPER(status) = ? AND created_at >= ?", userID, "APPROVED", startOfMonth).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&summary.ApprovedMTDAmount)

	// 3. Query ยอดไม่อนุมัติ (MTD)
	r.db.WithContext(ctx).Model(&poEntity.PO{}).
		Where("created_by = ? AND UPPER(status) = ? AND created_at >= ?", userID, "REJECTED", startOfMonth).
		Select("COALESCE(SUM(total_amount), 0)").
		Scan(&summary.RejectedMTDAmount)

	// 4. ดึงจำนวนใบสั่งซื้อทั้งหมดของเดือนนี้
	r.db.WithContext(ctx).Model(&poEntity.PO{}).
        Where("created_by = ? AND UPPER(status) = ? AND created_at >= ?", userID, "APPROVED", startOfMonth).
        Count(&summary.TotalCount)

	return &summary, nil
}

// Get เพื่อเช็คว่ามี PO นี้อยู่จริงไหมก่อนลบ
func (r *purchaseOrderRepository) GetPOByID(ctx context.Context, id uint) (*poEntity.PO, error) {
	var po poEntity.PO

	err := r.db.WithContext(ctx).
		Preload("PO_Items").
		First(&po, id).Error

	// ถ้ามี Error เกิดขึ้น (รวมถึงหาไม่เจอ gorm.ErrRecordNotFound) ส่งกลับไปให้ Service จัดการเลย
	if err != nil {
		return nil, err 
	}

	return &po, nil
}

// ลบแบบ Soft Delete เก็บไว้ 14 วัน
func (r *purchaseOrderRepository) DeletePOByID(ctx context.Context, id uint) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {

		// 1. Soft delete items ก่อน
		if err := tx.Where("po_id = ?", id).
			Delete(&poEntity.POItems{}).Error; err != nil {
			return err
		}

		// 2. Soft delete PO
		result := tx.Delete(&poEntity.PO{}, id)
		if result.Error != nil {
			return result.Error
		}

		if result.RowsAffected == 0 {
			return errors.New("purchase order not found")
		}

		return nil
	})
}

// Get เพื่อไปทำ PDF
func (r *purchaseOrderRepository) GetPOForPDF(ctx context.Context, id uint) (*poEntity.PO, error) {
	var po poEntity.PO
	
	err := r.db.WithContext(ctx).Where("id = ?", id).
		Preload("Creator").
		Preload("Supplier").
		Preload("PO_Type").
		Preload("PO_Items").
		First(&po, id).Error

	if err != nil {
		return nil, err
	}

	return &po, err
}