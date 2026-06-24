package claim

import (
	"backend/internal/app/entity"
	"time"
)

// CreateSupplierClaimDTO ใช้สำหรับรับค่าตอนสร้างรายการเคลมใหม่
type CreateSupplierClaimDTO struct {
	Note            string    `json:"note"`
	ClaimDate       time.Time `json:"claim_date" binding:"required"`
	Status          string    `json:"status" binding:"required"`
	ApprovedBy      uint      `json:"approved_by"` // กรณีถ้าต้องการกำหนด ApprovedBy ตั้งแต่ตอนสร้าง
	CreatedBy       uint      `json:"created_by" binding:"required"`
	PurchaseOrderID uint      `json:"purchase_order_id" binding:"required"`
	SupplierID      uint      `json:"supplier_id" binding:"required"`
}

// UpdateSupplierClaimDTO ใช้สำหรับรับค่าตอนแก้ไขรายการเคลม
type UpdateSupplierClaimDTO struct {
	Note       string `json:"note"`
	Status     string `json:"status"`
	ApprovedBy uint   `json:"approved_by"`
}

// SupplierClaimResponseDTO ใช้สำหรับส่งข้อมูลกลับไปให้หน้าบ้าน
type SupplierClaimResponseDTO struct {
	ID              uint      `json:"id"`
	Note            string    `json:"note"`
	ClaimDate       time.Time `json:"claim_date"`
	Status          string    `json:"status"`
	ApprovedBy      uint      `json:"approved_by"`
	CreatedBy       uint      `json:"created_by"`
	PurchaseOrderID uint      `json:"purchase_order_id"`
	SupplierID      uint      `json:"supplier_id"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// ToEntity แปลงจาก DTO เป็น Entity สำหรับบันทึกลง DB
func (d *CreateSupplierClaimDTO) ToEntity() entity.SupplierClaim {
	return entity.SupplierClaim{
		Note:            d.Note,
		ClaimDate:       d.ClaimDate,
		Status:          d.Status,
		ApprovedBy:      d.ApprovedBy,
		CreatedBy:       d.CreatedBy,
		PurchaseOrderID: d.PurchaseOrderID,
		SupplierID:      d.SupplierID,
	}
}

// ToSupplierClaimResponseDTO แปลงจาก Entity เป็น Response DTO เพื่อส่งให้หน้าบ้าน
func ToSupplierClaimResponseDTO(m *entity.SupplierClaim) SupplierClaimResponseDTO {
	return SupplierClaimResponseDTO{
		ID:              m.ID,
		Note:            m.Note,
		ClaimDate:       m.ClaimDate,
		Status:          m.Status,
		ApprovedBy:      m.ApprovedBy,
		CreatedBy:       m.CreatedBy,
		PurchaseOrderID: m.PurchaseOrderID,
		SupplierID:      m.SupplierID,
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}