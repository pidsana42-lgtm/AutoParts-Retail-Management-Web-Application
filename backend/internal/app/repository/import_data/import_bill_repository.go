package import_data

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

// 1. กำหนด Interface สำหรับ Bill Repository
type BillRepository interface {
	CreateBill(bill *entity.Bill) error
	GetBillByID(id uint) (*entity.Bill, error)
	ListBills() ([]entity.Bill, error)
	// สามารถเพิ่ม Method อื่นๆ ตามที่ต้องใช้ได้ เช่น Update, Delete, Search
}

// 2. สร้าง Struct สำหรับ Implment Interface
type billRepository struct {
	db *gorm.DB
}

// 3. ฟังก์ชันสำหรับสร้าง Repository Instance
func NewBillRepository(db *gorm.DB) BillRepository {
	return &billRepository{db: db}
}

// 4. Implement Method: สร้างบิลใหม่
func (r *billRepository) CreateBill(bill *entity.Bill) error {
	return r.db.Create(bill).Error
}

// 5. Implement Method: ดึงข้อมูลบิลตาม ID (พร้อมกับดึงข้อมูลที่เชื่อมโยงกันมาด้วย)
func (r *billRepository) GetBillByID(id uint) (*entity.Bill, error) {
	var bill entity.Bill
	// ใช้ Preload เพื่อดึงข้อมูลจากตารางที่เกี่ยวข้องกันมาด้วย
	err := r.db.Preload("BillItems").
		Preload("BillImage").
		Preload("VerifiedByUser").
		Preload("PO").
		First(&bill, id).Error
		
	if err != nil {
		return nil, err
	}
	return &bill, nil
}

// 6. Implement Method: ดึงรายการบิลทั้งหมด
func (r *billRepository) ListBills() ([]entity.Bill, error) {
	var bills []entity.Bill
	err := r.db.Preload("BillImage").
		Preload("VerifiedByUser").
		Preload("PO").
		Find(&bills).Error
		
	return bills, err
}