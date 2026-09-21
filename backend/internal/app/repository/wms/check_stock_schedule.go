package wms

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type CheckStockScheduleRepository interface {
	Create(schedule *entity.CheckStockSchedule) error
	GetByID(id uint) (*entity.CheckStockSchedule, error)
	UpdateStatus(id uint, status string) error
	Update(schedule *entity.CheckStockSchedule) error
	// ReplaceTargets/ReplaceExcludedProducts: ลบชุดเดิมทิ้งแล้วสร้างชุดใหม่ทั้งหมด (ใช้ตอนแก้ไขตาราง ที่เจ้าของร้าน
	// อาจเปลี่ยนเป้าหมาย/รายการที่เอาออกไปเป็นชุดใหม่ทั้งหมด) แยกจาก Update() เพราะ Update() ใช้ Save() ที่ Omit
	// สอง field นี้ไว้ (กัน GORM auto-save association ไปทับข้อมูลที่ยังไม่ตรงกับที่ตั้งใจ)
	ReplaceTargets(scheduleID uint, targets []entity.CheckStockScheduleTarget) error
	ReplaceExcludedProducts(scheduleID uint, excluded []entity.CheckStockScheduleExcludedProduct) error
	Delete(id uint) error
	List(status string) ([]entity.CheckStockSchedule, error)
}

type checkStockScheduleRepository struct {
	db *gorm.DB
}

func NewCheckStockScheduleRepository(db *gorm.DB) CheckStockScheduleRepository {
	return &checkStockScheduleRepository{db: db}
}

func (r *checkStockScheduleRepository) Create(schedule *entity.CheckStockSchedule) error {
	return r.db.Create(schedule).Error
}

func (r *checkStockScheduleRepository) GetByID(id uint) (*entity.CheckStockSchedule, error) {
	var s entity.CheckStockSchedule
	err := r.db.Preload("User").Preload("Targets").Preload("ExcludedProducts").First(&s, id).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *checkStockScheduleRepository) UpdateStatus(id uint, status string) error {
	return r.db.Model(&entity.CheckStockSchedule{}).Where("id = ?", id).Update("status", status).Error
}

func (r *checkStockScheduleRepository) Update(schedule *entity.CheckStockSchedule) error {
	// Omit("User") กันบั๊ก: GetByID() ข้างบน Preload("User") ไว้ พอมาเรียก Save() ตรงๆ
	// GORM จะเห็นว่า schedule.User (ข้อมูลพนักงานคนเดิมที่ preload มา) ยัง populate อยู่
	// แล้ว auto-save association ทับ user_id กลับไปเป็นพนักงานคนเดิมเสมอ ต่อให้ schedule.UserID
	// ถูกเซ็ตเป็นพนักงานคนใหม่แล้วก็ตาม (เปลี่ยนพนักงานผ่านหน้าแก้ไขจะไม่มีผลจริงในฐานข้อมูล)
	// Omit("Targets", "ExcludedProducts") เหตุผลเดียวกัน: GetByID preload มาแล้ว ถ้าไม่ omit จะโดน auto-save
	// association ไปแทรก/ทับซ้ำกับที่ service เป็นคนจัดการลบเก่า-เพิ่มใหม่เองแบบตรงไปตรงมาอยู่แล้ว (ดู Update() ใน service)
	return r.db.Omit("User", "Targets", "ExcludedProducts").Save(schedule).Error
}

func (r *checkStockScheduleRepository) ReplaceTargets(scheduleID uint, targets []entity.CheckStockScheduleTarget) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("check_stock_schedule_id = ?", scheduleID).Delete(&entity.CheckStockScheduleTarget{}).Error; err != nil {
			return err
		}
		if len(targets) == 0 {
			return nil
		}
		for i := range targets {
			targets[i].ID = 0
			targets[i].CheckStockScheduleID = scheduleID
		}
		return tx.Create(&targets).Error
	})
}

func (r *checkStockScheduleRepository) ReplaceExcludedProducts(scheduleID uint, excluded []entity.CheckStockScheduleExcludedProduct) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("check_stock_schedule_id = ?", scheduleID).Delete(&entity.CheckStockScheduleExcludedProduct{}).Error; err != nil {
			return err
		}
		if len(excluded) == 0 {
			return nil
		}
		for i := range excluded {
			excluded[i].ID = 0
			excluded[i].CheckStockScheduleID = scheduleID
		}
		return tx.Create(&excluded).Error
	})
}

func (r *checkStockScheduleRepository) Delete(id uint) error {
	return r.db.Delete(&entity.CheckStockSchedule{}, id).Error
}

func (r *checkStockScheduleRepository) List(status string) ([]entity.CheckStockSchedule, error) {
	var schedules []entity.CheckStockSchedule
	query := r.db.Model(&entity.CheckStockSchedule{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	return schedules, query.Preload("User").Preload("Targets").Preload("ExcludedProducts").Order("scheduled_date_time asc").Find(&schedules).Error
}
