package claim

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

// 1. กำหนด Interface สำหรับ SalesReturn Repository
type SalesReturnRepository interface {
	CreateSalesReturn(returnItem *entity.SalesReturn) error
	CreateSalesReturnItem(item *entity.SalesReturnItem) error
	GetSalesReturnByID(id uint) (*entity.SalesReturn, error)
	ListSalesReturns() ([]entity.SalesReturn, error)
	UpdateSalesReturn(returnItem *entity.SalesReturn) error
	DeleteSalesReturn(id uint) error
}

// 2. สร้าง Struct สำหรับ Implement Interface
type salesReturnRepository struct {
	db *gorm.DB
}

// 3. ฟังก์ชันสำหรับสร้าง Repository Instance
func NewSalesReturnRepository(db *gorm.DB) SalesReturnRepository {
	return &salesReturnRepository{db: db}
}

// 4. Implement Method: สร้างข้อมูลการเคลมของลูกค้าใหม่
func (r *salesReturnRepository) CreateSalesReturn(returnItem *entity.SalesReturn) error {
	return r.db.Create(returnItem).Error
}

func (r *salesReturnRepository) CreateSalesReturnItem(item *entity.SalesReturnItem) error {
	return r.db.Create(item).Error
}

// 5. Implement Method: ดึงข้อมูลการเคลมของลูกค้าตาม ID
func (r *salesReturnRepository) GetSalesReturnByID(id uint) (*entity.SalesReturn, error) {
	var returnItem entity.SalesReturn
	
	// ใช้ Preload อ้างอิงจาก Foreign Key ที่มีใน entity.CustomerClaim
	err := r.db.Preload("OriginalOrder").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		First(&returnItem, id).Error
		
	if err != nil {
		return nil, err
	}
	return &returnItem, nil
}

// 6. Implement Method: ดึงรายการเคลมของลูกค้าทั้งหมด
func (r *salesReturnRepository) ListSalesReturns() ([]entity.SalesReturn, error) {
	returnItems := make([]entity.SalesReturn, 0)
	
	// ใช้ Preload เพื่อให้ข้อมูลที่เกี่ยวข้องทั้งหมดแนบมาด้วย
	err := r.db.Preload("OriginalOrder").
		Preload("CreatedByUser").
		Preload("ApprovedByUser").
		Find(&returnItems).Error
		
	return returnItems, err
}

// 7. Implement Method: อัปเดตข้อมูลการเคลมของลูกค้า (เช่น การอัปเดตสถานะ หรือผู้อนุมัติ)
func (r *salesReturnRepository) UpdateSalesReturn(returnItem *entity.SalesReturn) error {
	return r.db.Save(returnItem).Error
}

// 8. Implement Method: ลบข้อมูลการเคลมของลูกค้า (Soft Delete)
func (r *salesReturnRepository) DeleteSalesReturn(id uint) error {
	return r.db.Delete(&entity.SalesReturn{}, id).Error
}