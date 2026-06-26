package claim

import (
	"backend/internal/app/entity"
	"time"
)

// CreateSupplierClaimItemDTO ใช้สำหรับรับค่าตอนเพิ่มสินค้าลงในรายการเคลม
type CreateSupplierClaimItemDTO struct {
	SupplierClaimID     uint   `json:"supplier_claim_id" binding:"required"`
	ProductID           uint   `json:"product_id" binding:"required"`
	CustomerClaimItemID uint   `json:"customer_claim_item_id" binding:"required"`
	Qty                 uint   `json:"qty" binding:"required"`
	Resolution          string `json:"resolution"`
	ClaimType           string `json:"claim_type" binding:"required"`
	Reason              string `json:"reason"`
}

// UpdateSupplierClaimItemDTO ใช้สำหรับแก้ไขรายการเคลม
type UpdateSupplierClaimItemDTO struct {
	Qty        uint   `json:"qty"`
	Resolution string `json:"resolution"`
	ClaimType  string `json:"claim_type"`
	Reason     string `json:"reason"`
}

// SupplierClaimItemResponseDTO ใช้สำหรับส่งข้อมูลกลับไปให้หน้าบ้าน
type SupplierClaimItemResponseDTO struct {
	ID                  uint      `json:"id"`
	SupplierClaimID     uint      `json:"supplier_claim_id"`
	ProductID           uint      `json:"product_id"`
	CustomerClaimItemID uint      `json:"customer_claim_item_id"`
	Qty                 uint      `json:"qty"`
	Resolution          string    `json:"resolution"`
	ClaimType           string    `json:"claim_type"`
	Reason              string    `json:"reason"`
	CreatedAt           time.Time `json:"created_at"`
	UpdatedAt           time.Time `json:"updated_at"`
}

// ToEntity แปลงจาก DTO เป็น Entity สำหรับบันทึกลง DB
func (d *CreateSupplierClaimItemDTO) ToEntity() entity.SupplierClaimItem {
	return entity.SupplierClaimItem{
		SupplierClaimID:     d.SupplierClaimID,
		ProductID:           d.ProductID,
		CustomerClaimItemID: d.CustomerClaimItemID,
		Qty:                 d.Qty,
		Resolution:          d.Resolution,
		ClaimType:           d.ClaimType,
		Reason:              d.Reason,
	}
}

// ToSupplierClaimItemResponseDTO แปลงจาก Entity เป็น Response DTO
func ToSupplierClaimItemResponseDTO(m *entity.SupplierClaimItem) SupplierClaimItemResponseDTO {
	return SupplierClaimItemResponseDTO{
		ID:                  m.ID,
		SupplierClaimID:     m.SupplierClaimID,
		ProductID:           m.ProductID,
		CustomerClaimItemID: m.CustomerClaimItemID,
		Qty:                 m.Qty,
		Resolution:          m.Resolution,
		ClaimType:           m.ClaimType,
		Reason:              m.Reason,
		CreatedAt:           m.CreatedAt,
		UpdatedAt:           m.UpdatedAt,
	}
}