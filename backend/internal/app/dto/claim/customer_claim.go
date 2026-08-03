package claim

import (
	"strings"
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
	ClaimNo         string                         `json:"claim_no"`
	OriginalOrderID uint                           `json:"original_order_id"`
	CustomerName    string                         `json:"customer_name"`
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
	return entity.CustomerClaim{
		OriginalOrderID: d.OriginalOrderID,
		ReturnID:        d.ReturnID,
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
	items := make([]CustomerClaimItemResponseDTO, 0, len(m.Items))
	for i := range m.Items {
		items = append(items, ToCustomerClaimItemResponseDTO(&m.Items[i]))
	}
	customerName := "-"
	if m.OriginalOrder != nil {
		if m.OriginalOrder.Customer.CustomerName != "" {
			customerName = m.OriginalOrder.Customer.CustomerName
		} else if m.OriginalOrder.CustomerNameTemp != nil && *m.OriginalOrder.CustomerNameTemp != "" {
			customerName = *m.OriginalOrder.CustomerNameTemp
		}
	}
	if customerName == "-" && m.Note != "" {
		for _, part := range strings.Split(m.Note, "|") {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(part, "ลูกค้า:") {
				parsed := strings.TrimSpace(strings.TrimPrefix(part, "ลูกค้า:"))
				if parsed != "" {
					customerName = parsed
				}
			}
		}
	}

	return CustomerClaimResponseDTO{
		ID:              m.ID,
		ClaimNo:         m.ClaimNo,
		OriginalOrderID: m.OriginalOrderID,
		CustomerName:    customerName,
		ReturnID:        m.ReturnID,
		Status:          m.Status,
		Notes:           m.Note,
		ClaimDate:       m.ClaimDate,
		CreatedBy:       m.CreatedBy,
		ApprovedBy:      m.ApprovedBy,
		Items:           items,
	}
}