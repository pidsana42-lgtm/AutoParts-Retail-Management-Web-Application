package claim

import (
	"time"

	"backend/internal/app/entity"
)

// CreateCustomerClaimDTO ใช้สำหรับรับข้อมูลตอนลูกค้าเปิดบิลเคลมใหม่
type CreateCustomerClaimDTO struct {
	OriginalOrderID uint                         `json:"original_order_id" binding:"required"` // อ้างอิงออเดอร์เดิมที่ซื้อไป
	ReturnID        *uint                        `json:"return_id"`                            // อ้างอิงบิลรับคืน (ถ้ามี/บังคับแล้วแต่ Business Logic)
	Notes           string                       `json:"notes"`
	// เปิดให้สามารถสร้างรายการสินค้า (Items) พร้อมกับหัวบิลได้เลย
	Items           []CreateCustomerClaimItemDTO `json:"items" binding:"required,dive"` 
}

// UpdateCustomerClaimDTO ใช้สำหรับแก้ไขข้อมูลหัวบิล หรือเปลี่ยนสถานะ (เช่น พนักงานกดอนุมัติ)
type UpdateCustomerClaimDTO struct {
	Status     string `json:"status"`      // เช่น "Pending", "Approved", "Rejected"
	Notes      string `json:"notes"`
	ApprovedBy *uint  `json:"approved_by"` // ไอดีพนักงานผู้อนุมัติ (มักจะดึงจาก Token แต่เผื่อรับจาก Request ในบางกรณี)
}


// CustomerClaimResponseDTO ใช้สำหรับส่งข้อมูล Customer Claim กลับไปแสดงผล
type CustomerClaimResponseDTO struct {
	ID              uint                           `json:"id"`
	OriginalOrderID uint                           `json:"original_order_id"`
	ReturnID        *uint                          `json:"return_id"`
	Status          string                         `json:"status"`
	Notes           string                         `json:"notes"`
	ClaimDate       time.Time                      `json:"claim_date"`
	CreatedBy       uint                           `json:"created_by"`
	ApprovedBy      *uint                          `json:"approved_by"`
	// แนบรายการ Items กลับไปด้วยเสมอเพื่อให้ Frontend แสดงผลได้ครบถ้วน
	Items           []CustomerClaimItemResponseDTO `json:"items"`
}

func (d *CreateCustomerClaimDTO) ToEntity() entity.CustomerClaim {
	var returnID uint
	if d.ReturnID != nil {
		returnID = *d.ReturnID
	}
	return entity.CustomerClaim{
		OriginalOrderID: d.OriginalOrderID,
		ReturnID:        returnID,
		Note:            d.Notes,
		Status:          "Pending",
		ClaimDate:       time.Now(),
	}
}

func (d *UpdateCustomerClaimDTO) ToEntity(existing entity.CustomerClaim) entity.CustomerClaim {
	if d.Status != "" {
		existing.Status = d.Status
	}
	if d.Notes != "" {
		existing.Note = d.Notes
	}
	if d.ApprovedBy != nil {
		existing.ApprovedBy = d.ApprovedBy
	}
	return existing
}

func ToCustomerClaimResponseDTO(m *entity.CustomerClaim) CustomerClaimResponseDTO {
	var returnID *uint
	if m.ReturnID != 0 {
		returnID = &m.ReturnID
	}
	return CustomerClaimResponseDTO{
		ID:              m.ID,
		OriginalOrderID: m.OriginalOrderID,
		ReturnID:        returnID,
		Status:          m.Status,
		Notes:           m.Note,
		ClaimDate:       m.ClaimDate,
		CreatedBy:       m.CreatedBy,
		ApprovedBy:      m.ApprovedBy,
		Items:           []CustomerClaimItemResponseDTO{},
	}
}