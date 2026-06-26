package claim

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

// 1. กำหนด Interface สำหรับ SupplierClaim Repository
type SupplierClaimRepository interface {
	CreateSupplierClaim(claim *entity.SupplierClaim) error
	CreateSupplierClaimItem(item *entity.SupplierClaimItem) error
	GetSupplierClaimByID(id uint) (*entity.SupplierClaim, error)
	ListSupplierClaims() ([]entity.SupplierClaim, error)
	UpdateSupplierClaim(claim *entity.SupplierClaim) error
	DeleteSupplierClaim(id uint) error
}

// 2. สร้าง Struct สำหรับ Implement Interface
type supplierClaimRepository struct {
	db *gorm.DB
}

// 3. ฟังก์ชันสำหรับสร้าง Repository Instance
func NewSupplierClaimRepository(db *gorm.DB) SupplierClaimRepository {
	return &supplierClaimRepository{db: db}
}

// 4. Implement Method: สร้างข้อมูลการเคลมซัพพลายเออร์ใหม่
func (r *supplierClaimRepository) CreateSupplierClaim(claim *entity.SupplierClaim) error {
	return r.db.Create(claim).Error
}

func (r *supplierClaimRepository) CreateSupplierClaimItem(item *entity.SupplierClaimItem) error {
	return r.db.Create(item).Error
}

// 5. Implement Method: ดึงข้อมูลการเคลมซัพพลายเออร์ตาม ID
func (r *supplierClaimRepository) GetSupplierClaimByID(id uint) (*entity.SupplierClaim, error) {
	var claim entity.SupplierClaim
	
	// ใช้ Preload อ้างอิงจาก Foreign Key ที่มีใน entity.SupplierClaim
	err := r.db.Preload("ApproveBy").
		Preload("CreatedByUser").
		Preload("PurchaseOrder").
		Preload("Supplier").
		First(&claim, id).Error
		
	if err != nil {
		return nil, err
	}
	return &claim, nil
}

// 6. Implement Method: ดึงรายการเคลมซัพพลายเออร์ทั้งหมด
func (r *supplierClaimRepository) ListSupplierClaims() ([]entity.SupplierClaim, error) {
	var claims []entity.SupplierClaim
	
	// ใช้ Preload เพื่อให้ข้อมูลพนักงาน, ใบสั่งซื้อ, และซัพพลายเออร์แนบมาด้วย
	err := r.db.Preload("ApproveBy").
		Preload("CreatedByUser").
		Preload("PurchaseOrder").
		Preload("Supplier").
		Find(&claims).Error
		
	return claims, err
}

// 7. Implement Method: อัปเดตข้อมูลการเคลมซัพพลายเออร์ (เช่น เปลี่ยนสถานะ)
func (r *supplierClaimRepository) UpdateSupplierClaim(claim *entity.SupplierClaim) error {
	// ใช้ Save เพื่ออัปเดตข้อมูลทั้งหมดของ object ที่ส่งเข้ามา
	return r.db.Save(claim).Error
}

// 8. Implement Method: ลบข้อมูลการเคลมซัพพลายเออร์ (Soft Delete ตาม gorm.Model)
func (r *supplierClaimRepository) DeleteSupplierClaim(id uint) error {
	return r.db.Delete(&entity.SupplierClaim{}, id).Error
}