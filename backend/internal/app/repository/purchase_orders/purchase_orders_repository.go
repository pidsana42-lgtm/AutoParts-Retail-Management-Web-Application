package purchaseorders

import (
	"fmt"
	"time"
	"errors"
	"strings"
	"context"
	"strconv"
	"hash/fnv"
	"gorm.io/gorm"
	poEntity "backend/internal/app/entity"
	poEnum "backend/internal/app/enum"
	poDto "backend/internal/app/dto/purchase_orders"
)

// PurchaseOrderRepository คุมตาราง purchase_orders และ po_items
type PurchaseOrderRepository interface {
	SavePO(ctx context.Context, po *poEntity.PO) error
	FindAll(ctx context.Context, query poDto.ListPOQuery) ([]poEntity.PO, int64, error)
	DeletePOByID(ctx context.Context, id uint, status string, expiredAt time.Time) error
	GetPOByID(ctx context.Context, id uint) (*poEntity.PO, error)
	GetPOForPDF(ctx context.Context, id uint) (*poEntity.PO, error)
	GetPOSummary(ctx context.Context) (*poDto.POSummaryResponse, error)
	SyncItems(ctx context.Context, poID uint, incoming []poEntity.POItems) error
	GetPOWithRelations(ctx context.Context, id uint) (*poEntity.PO, error)
	UpdatePO(ctx context.Context, po *poEntity.PO) error
	GetSupplierDeliveryHistory(ctx context.Context, supplierID int) ([]POHistory, error)
	GetMonthlyPOCount(ctx context.Context) (int64, error)
	GetCompanySetting(ctx context.Context) (*poEntity.CompanySetting, error)
	UpdateStatusAndRejection(ctx context.Context, id uint, status poEnum.POStatus, reason string) error
	UpdateStatusToExpired(ctx context.Context) error
	HardDeleteExpiredPOs(ctx context.Context) error
	RestorePOByID(ctx context.Context, id uint) error
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

// POHistory Record โครงสร้างข้อมูลสำหรับฝั่ง Database
type POHistory struct {
	CreatedAt  	time.Time
	ReceivedAt 	time.Time 	`gorm:"-" json:"received_at"`
}

// Save บันทึกใบสั่งซื้อพร้อมไอเทมลูกทั้งหมดลง Database (มีระบบ Transaction ป้องกันข้อมูลพัง)
func (r *purchaseOrderRepository) SavePO(ctx context.Context, po *poEntity.PO) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		currentYear := time.Now().Format("2006")
		prefix := fmt.Sprintf("PO-%s-", currentYear)

		// ล็อกด้วย key ที่แปลงจากปี (เช่น "2026" → เลข hash คงที่)
		// ล็อกนี้อยู่แค่ในช่วง transaction นี้ และปล่อยอัตโนมัติตอน COMMIT/ROLLBACK
		lockKey := hashYearToInt(currentYear)
		if err := tx.Exec("SELECT pg_advisory_xact_lock(?)", lockKey).Error; err != nil {
			return err
		}

		// ตอนนี้การันตีว่ามีแค่ transaction เดียวที่ผ่านจุดนี้ไปได้ในเวลาเดียวกัน
		// สำหรับปีเดียวกัน จึงอ่าน-คำนวณ-insert ได้อย่างปลอดภัย
		var latestPONumber string
		err := tx.Unscoped().Model(&poEntity.PO{}).
			Where("po_number LIKE ?", prefix+"%").
			Order("po_number DESC").
			Limit(1).
			Pluck("po_number", &latestPONumber).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		nextSequence := 1
		if latestPONumber != "" {
			parts := strings.Split(latestPONumber, "-")
			if len(parts) == 3 {
				if lastSeq, convErr := strconv.Atoi(parts[2]); convErr == nil {
					nextSequence = lastSeq + 1
				}
			}
		}
		po.PO_number = fmt.Sprintf("%s%04d", prefix, nextSequence)

		return tx.Create(po).Error
	})
}

func hashYearToInt(year string) int64 {
	h := fnv.New64a()
	h.Write([]byte("po_number_" + year))
	return int64(h.Sum64())
}

func (r *purchaseOrderRepository) FindAll(ctx context.Context, query poDto.ListPOQuery) ([]poEntity.PO, int64, error) {
	var po []poEntity.PO
	var total int64

	dbQuery := r.db.WithContext(ctx).Unscoped().Model(&poEntity.PO{})

	// Filter Status
	if query.Status != "" {
		dbQuery = dbQuery.Where("status = ?", query.Status)
	}
	// Filter Search
	if query.Search != "" {
		dbQuery = dbQuery.Where("po_number LIKE ?", "%"+query.Search+"%")
	}
	// Filter Date
	if query.Month != "" {
		startDate, err := time.Parse("2006-01", query.Month)
		
		if err == nil {
			endDate := startDate.AddDate(0, 1, 0)
			dbQuery = dbQuery.Where("created_at >= ? AND created_at < ?", startDate, endDate)
		}
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

func (r *purchaseOrderRepository) GetPOSummary(ctx context.Context) (*poDto.POSummaryResponse, error) {
    var summary poDto.POSummaryResponse

    // หาวันที่ 1 ของเดือนปัจจุบัน (สำหรับ MTD)
    now := time.Now()
    startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

    // 1. Query ยอดรออนุมัติ
    r.db.WithContext(ctx).Model(&poEntity.PO{}).Where("UPPER(status) = ?", "PENDING").
		Select("COALESCE(SUM(total_amount), 0)").Scan(&summary.PendingAmount)

    // 2. Query ยอดอนุมัติแล้ว (MTD)
    r.db.WithContext(ctx).Model(&poEntity.PO{}).Where("UPPER(status) = ? AND created_at >= ?", "APPROVED", startOfMonth).
        Select("COALESCE(SUM(total_amount), 0)").Scan(&summary.ApprovedMTDAmount)

    // 3. Query ยอดไม่อนุมัติ (MTD)
    r.db.WithContext(ctx).Model(&poEntity.PO{}).Where("UPPER(status) = ? AND created_at >= ?", "REJECTED", startOfMonth).
        Select("COALESCE(SUM(total_amount), 0)").Scan(&summary.RejectedMTDAmount)

    // 4. Query ยอดไม่อนุมัติแยกตามบริษัท (MTD)
    r.db.WithContext(ctx).Table("purchase_orders").Select("suppliers.supplier_name, COALESCE(SUM(purchase_orders.total_amount), 0) as amount").
        Joins("JOIN suppliers ON suppliers.id = purchase_orders.supplier_id").
		Where("UPPER(purchase_orders.status) = ? AND purchase_orders.created_at >= ?", "REJECTED", startOfMonth).
        Group("suppliers.supplier_name").Scan(&summary.RejectedBySupplier)

    // กรณีที่ไม่มีข้อมูลไม่อนุมัติเลย ให้กำหนดเป็น Array ว่างแทน nil เพื่อป้องกัน Error ฝั่ง Frontend
    if summary.RejectedBySupplier == nil {
        summary.RejectedBySupplier = []poDto.SupplierRejectedSummary{}
    }

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

// ลบแบบ Soft Delete เก็บไว้ 7 วัน
func (r *purchaseOrderRepository) DeletePOByID(ctx context.Context, id uint, status string, expiredAt time.Time) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {

		// อัปเดตตาราง PO ให้เปลี่ยน Status เป็น "DELETED" และเซ็ต ExpiredAt ใหม่
        result := tx.Model(&poEntity.PO{}).
            Where("id = ?", id).
            Updates(map[string]interface{}{
                "status":     "DELETED",
                "expires_at": expiredAt,
            })

        if result.Error != nil {
            return result.Error
        }

        if result.RowsAffected == 0 {
            return errors.New("purchase order not found")
        }

		// หมายเหตุเรื่อง POItems:
        // ในเมื่อเราใช้ status ของ PO เป็นตัวบอกว่าถูกทิ้งลงถังขยะแล้ว
        // เราจึงไม่จำเป็นต้องลบ POItems ทิ้ง (เอาโค้ด Delete POItems ออกได้เลย)
        // เพราะถ้าผู้ใช้กด "กู้คืน (Restore)" ตัว POItems ก็จะกลับมาพร้อมใช้งานทันทีโดยไม่ต้องไปตามกู้คืนแยกครับ

		return nil
	})
}

// 1. ฟังก์ชันอัปเดตสถานะ (รันทุกวัน) จาก DELETED/RESUBMITTED เป็น EXPIRED
func (r *purchaseOrderRepository) UpdateStatusToExpired(ctx context.Context) error {
    // หาเวลาเมื่อ 7 วันที่แล้ว
    sevenDaysAgo := time.Now().AddDate(0, 0, -7)
    
    // ตั้งเวลาหมดอายุสำหรับการกู้คืน เป็นอีก 7 วันนับจากตอนที่เปลี่ยนสถานะเป็น EXPIRED
    restoreDeadline := time.Now().AddDate(0, 0, 7)

    // ค้นหา PO ที่ถูก DELETED/RESUBMITTED มาแล้วเกิน 7 วัน (เช็กจาก updated_at) 
    // แล้วจับเปลี่ยนเป็น EXPIRED พร้อมตั้งค่า expired_at
    return r.db.WithContext(ctx).
        Model(&poEntity.PO{}).
        Where("status IN ? AND updated_at < ?", []string{"DELETED", "RESUBMITTED"}, sevenDaysAgo).
        Updates(map[string]interface{}{
            "status":     "EXPIRED",
            "expires_at": restoreDeadline,
        }).Error
}

// 2. ฟังก์ชันลบถาวร (รันทุกวันที่ 30)
func (r *purchaseOrderRepository) HardDeleteExpiredPOs(ctx context.Context) error {
    return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
        var expiredPOIds []uint
        
        // ค้นหา PO ที่สถานะ EXPIRED และเลยกำหนดเวลากู้คืน (expired_at) ไปแล้ว
        if err := tx.Model(&poEntity.PO{}).
            Where("status = ? AND expires_at < ?", "EXPIRED", time.Now()).
            Pluck("id", &expiredPOIds).Error; err != nil {
            return err
        }

        if len(expiredPOIds) == 0 {
            return nil // ไม่มีข้อมูลให้ลบ
        }

        // ลบ Items ถาวร
        if err := tx.Unscoped().
            Where("po_id IN ?", expiredPOIds).
            Delete(&poEntity.POItems{}).Error; err != nil {
            return err
        }

        // ลบ PO ถาวร
        if err := tx.Unscoped().
            Where("id IN ?", expiredPOIds).
            Delete(&poEntity.PO{}).Error; err != nil {
            return err
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

// SyncItems: update รายการเดิมที่มี id ตรงกัน, insert รายการใหม่, ลบรายการที่ผู้ใช้เอาออก
func (r *purchaseOrderRepository) SyncItems(ctx context.Context, poID uint, incoming []poEntity.POItems) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var existing []poEntity.POItems
		if err := tx.Where("po_id = ?", poID).Find(&existing).Error; err != nil {
			return err
		}

		existingMap := make(map[uint]bool, len(existing))
		for _, item := range existing {
			existingMap[item.ID] = true
		}

		incomingIDs := make(map[uint]bool)

		for _, item := range incoming {
			item.POID = poID

			if item.ID != 0 && existingMap[item.ID] {
				// item เดิม และมีอยู่จริงใน DB ของ PO นี้ → UPDATE
				incomingIDs[item.ID] = true
				if err := tx.Model(&poEntity.POItems{}).
					Where("id = ? AND po_id = ?", item.ID, poID).
					Updates(map[string]interface{}{
						"product_id":                      item.ProductID,
						"product_name_snapshot":           item.Product_name_snapshot,
						"supply_product_code_snapshot":    item.Supply_product_code_snapshot,
						"quantity":                        item.Quantity,
						"unit":                            item.Unit,
						"unit_price":                      item.UnitPrice,
						"sub_total":                       item.SubTotal,
						"notes":                           item.Notes,
						"alert_id":                        item.AlertID,
						"pre_order_item_id":               item.PreOrderItemID,
					}).Error; err != nil {
					return err
				}
			} else {
				// ไม่มี id หรือ id ไม่ตรงกับของ PO นี้จริง → ถือเป็นรายการใหม่
				item.ID = 0
				if err := tx.Create(&item).Error; err != nil {
					return err
				}
			}
		}

		// item เดิมที่หายไปจาก request = ผู้ใช้ลบออกจากหน้าจอ → soft delete เฉพาะตัวที่หาย
		for id := range existingMap {
			if !incomingIDs[id] {
				if err := tx.Delete(&poEntity.POItems{}, id).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}
// Get เพื่อคืน PO พร้อม relations ครบ สำหรับตอบกลับหลัง update
func (r *purchaseOrderRepository) GetPOWithRelations(ctx context.Context, id uint) (*poEntity.PO, error) {
	var po poEntity.PO

	err := r.db.WithContext(ctx).
		Preload("Creator").
		Preload("UpdatedByUser").
		Preload("Supplier").
		Preload("PO_Type").
		Preload("PO_Items").
		Preload("PO_Items.Alert").
		Preload("PO_Items.PreOrderItem").
		First(&po, id).Error

	if err != nil {
		return nil, err
	}

	return &po, nil
}

// UpdatePO บันทึกการแก้ไข PO ที่มีอยู่แล้ว
func (r *purchaseOrderRepository) UpdatePO(ctx context.Context, po *poEntity.PO) error {
	return r.db.WithContext(ctx).Save(po).Error
}


func (r *purchaseOrderRepository) GetSupplierDeliveryHistory(ctx context.Context, supplierID int) ([]POHistory, error) {
    var history []POHistory

    err := r.db.WithContext(ctx).
        Table("purchase_orders").
        Select("purchase_orders.created_at, bills.receive_date").
        Joins("INNER JOIN bills ON bills.po_id = purchase_orders.id").
        Where("purchase_orders.supplier_id = ?", supplierID).
        Where("purchase_orders.status = ?", "APPROVED").
        Where("bills.receive_date IS NOT NULL").
        Order("purchase_orders.created_at DESC").
        Scan(&history).Error

    if err != nil {
        return nil, err
    }

    return history, nil
}

// GetMonthlyPOCount นับจำนวนใบสั่งซื้อที่อนุมัติแล้วของเดือนนี้ — เปิดให้ทุก role เรียกได้
func (r *purchaseOrderRepository) GetMonthlyPOCount(ctx context.Context) (int64, error) {
	now := time.Now()
	startOfMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())

	var count int64
	if err := r.db.WithContext(ctx).Model(&poEntity.PO{}).
		Where("UPPER(status) = ? AND created_at >= ?", "APPROVED", startOfMonth).
		Count(&count).Error; err != nil {
		return 0, fmt.Errorf("count monthly po: %w", err)
	}
	return count, nil
}

func (r *purchaseOrderRepository) GetCompanySetting(ctx context.Context) (*poEntity.CompanySetting, error) {
	var setting poEntity.CompanySetting

	if err := r.db.WithContext(ctx).First(&setting).Error; err != nil {
		return nil, err
	}

	return &setting, nil
}

func (r *purchaseOrderRepository) UpdateStatusAndRejection(ctx context.Context, id uint, status poEnum.POStatus, reason string) error {
	var reasonPtr *string
	if reason != "" {
		reasonPtr = &reason
	}

	return r.db.WithContext(ctx).
		Model(&poEntity.PO{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"status":           status,
			"rejection_reason": reasonPtr,
		}).Error
}

func (r *purchaseOrderRepository) RestorePOByID(ctx context.Context, id uint) error {
	result := r.db.WithContext(ctx).
		Model(&poEntity.PO{}).
		Where("id = ? AND status = ?", id, "DELETED").
		Updates(map[string]interface{}{
			"status":           "DRAFT",
			"rejection_reason": nil, // ล้างทิ้ง เริ่มต้นใหม่แบบสะอาด
			"expires_at":       nil,
		})

	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("ไม่พบใบสั่งซื้อในถังขยะ หรือถูกกู้คืนไปแล้ว")
	}
	return nil
}