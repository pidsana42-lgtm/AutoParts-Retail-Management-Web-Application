package claim

import (
	"strings"
	"time"

	"backend/internal/app/entity"
)

// CreateCustomerClaimDTO ใช้สำหรับรับข้อมูลตอนลูกค้าเปิดบิลเคลมใหม่
type CreateCustomerClaimDTO struct {
	OriginalOrderID uint       `json:"original_order_id" binding:"required"` // อ้างอิงออเดอร์เดิมที่ซื้อไป
	ReturnID        *uint      `json:"return_id"`                            // อ้างอิงบิลรับคืน (ถ้ามี/บังคับแล้วแต่ Business Logic)
	Status          string     `json:"status"`
	Notes           string     `json:"notes"`
	ClaimDate       *time.Time `json:"claim_date"`
	CustomerName    string     `json:"customer_name"`
	CustomerPhone   string     `json:"customer_phone"`
	ClaimType       string     `json:"claim_type"`
	ClaimAmount     float64    `json:"claim_amount" binding:"gte=0"`
	RefundAmount    float64    `json:"refund_amount" binding:"gte=0"`
	ReplacementCost float64    `json:"replacement_cost" binding:"gte=0"`
	// เปิดให้สามารถสร้างรายการสินค้า (Items) พร้อมกับหัวบิลได้เลย
	Items []CreateCustomerClaimItemDTO `json:"items" binding:"required,min=1,dive"`
}

// UpdateCustomerClaimDTO ใช้สำหรับแก้ไขข้อมูลหัวบิล หรือเปลี่ยนสถานะ (เช่น พนักงานกดอนุมัติ)
type UpdateCustomerClaimDTO struct {
	Status          string     `json:"status"` // เช่น "Pending", "Approved", "Rejected"
	Notes           string     `json:"notes"`
	ApprovedBy      *uint      `json:"approved_by"` // ไอดีพนักงานผู้อนุมัติ
	ClaimDate       *time.Time `json:"claim_date"`
	CustomerName    string     `json:"customer_name"`
	CustomerPhone   string     `json:"customer_phone"`
	ClaimType       string     `json:"claim_type"`
	ClaimAmount     float64    `json:"claim_amount" binding:"gte=0"`
	RefundAmount    float64    `json:"refund_amount" binding:"gte=0"`
	ReplacementCost float64    `json:"replacement_cost" binding:"gte=0"`
	// สถานะการดำเนินงาน
	SupplierResponseStatus string `json:"supplier_response_status"` // WAITING, APPROVED, REJECTED
	CustomerReceivedItem   *bool  `json:"customer_received_item"`
	CustomerWaiting        *bool  `json:"customer_waiting"`
	OperationNote          string `json:"operation_note"`
}

// CustomerClaimResponseDTO ใช้สำหรับส่งข้อมูล Customer Claim กลับไปแสดงผล
type CustomerClaimResponseDTO struct {
	ID              uint      `json:"id"`
	ClaimNo         string    `json:"claim_no"`
	OriginalOrderID uint      `json:"original_order_id"`
	OrderNumber     string    `json:"order_number"`
	CustomerName    string    `json:"customer_name"`
	CustomerPhone   string    `json:"customer_phone"`
	ClaimType       string    `json:"claim_type"`
	ClaimAmount     float64   `json:"claim_amount"`
	RefundAmount    float64   `json:"refund_amount"`
	ReplacementCost float64   `json:"replacement_cost"`
	ReturnID        *uint     `json:"return_id"`
	Status          string    `json:"status"`
	Notes           string    `json:"notes"`
	ClaimDate       time.Time `json:"claim_date"`
	CreatedBy       uint      `json:"created_by"`
	ApprovedBy      *uint     `json:"approved_by"`
	// สถานะการดำเนินงาน
	SupplierResponseStatus string `json:"supplier_response_status"`
	CustomerReceivedItem   *bool  `json:"customer_received_item"`
	CustomerWaiting        bool   `json:"customer_waiting"`
	OperationNote          string `json:"operation_note"`
	// แนบรายการ Items กลับไปด้วยเสมอเพื่อให้ Frontend แสดงผลได้ครบถ้วน
	Items []CustomerClaimItemResponseDTO `json:"items"`
}

func (d *CreateCustomerClaimDTO) ToEntity() entity.CustomerClaim {
	claimDate := time.Now()
	if d.ClaimDate != nil {
		claimDate = *d.ClaimDate
	}
	return entity.CustomerClaim{
		OriginalOrderID: d.OriginalOrderID,
		ReturnID:        d.ReturnID,
		Note:            d.Notes,
		Status: func() string {
			if d.Status != "" {
				return d.Status
			}
			return "Pending"
		}(),
		ClaimDate:       claimDate,
		CustomerName:    d.CustomerName,
		CustomerPhone:   d.CustomerPhone,
		ClaimType:       d.ClaimType,
		ClaimAmount:     d.ClaimAmount,
		RefundAmount:    d.RefundAmount,
		ReplacementCost: d.ReplacementCost,
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
	if d.ClaimDate != nil {
		existing.ClaimDate = *d.ClaimDate
	}
	if d.CustomerName != "" {
		existing.CustomerName = d.CustomerName
	}
	if d.CustomerPhone != "" {
		existing.CustomerPhone = d.CustomerPhone
	}
	if d.ClaimType != "" {
		existing.ClaimType = d.ClaimType
	}
	if d.ClaimAmount != 0 {
		existing.ClaimAmount = d.ClaimAmount
	}
	if d.RefundAmount != 0 {
		existing.RefundAmount = d.RefundAmount
	}
	if d.ReplacementCost != 0 {
		existing.ReplacementCost = d.ReplacementCost
	}
	// อัพเดต operation fields
	if d.SupplierResponseStatus != "" {
		existing.SupplierResponseStatus = d.SupplierResponseStatus
	}
	if d.CustomerReceivedItem != nil {
		existing.CustomerReceivedItem = d.CustomerReceivedItem
	}
	if d.CustomerWaiting != nil {
		existing.CustomerWaiting = *d.CustomerWaiting
	}
	if d.OperationNote != "" {
		existing.OperationNote = d.OperationNote
	}
	return existing
}

// cleanNoteText กรอง metadata เก่าออก เหลือแค่ส่วนที่เป็นหมายเหตุจริงๆ
// (เพราะข้อมูลเก่าถูกเก็บรวมไว้ใน Note เดียวแบบ ลูกค้า: ... | โทร: ... | ประเภทเคลม: ...)
func cleanNoteText(note string) string {
	metadataKeys := []string{"\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32:", "\u0e42\u0e17\u0e23:", "\u0e1b\u0e23\u0e30\u0e40\u0e20\u0e17\u0e40\u0e04\u0e25\u0e21:"}
	parts := strings.Split(note, "|")
	var cleaned []string
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		isMetadata := false
		for _, key := range metadataKeys {
			if strings.HasPrefix(part, key) {
				isMetadata = true
				break
			}
		}
		if !isMetadata {
			cleaned = append(cleaned, part)
		}
	}
	return strings.Join(cleaned, " | ")
}

func ToCustomerClaimResponseDTO(m *entity.CustomerClaim) CustomerClaimResponseDTO {
	items := make([]CustomerClaimItemResponseDTO, 0, len(m.Items))
	for i := range m.Items {
		items = append(items, ToCustomerClaimItemResponseDTO(&m.Items[i]))
	}
	customerName := m.CustomerName
	if customerName == "" && m.OriginalOrder != nil {
		if m.OriginalOrder.Customer.CustomerName != "" {
			customerName = m.OriginalOrder.Customer.CustomerName
		} else if m.OriginalOrder.CustomerNameTemp != nil && *m.OriginalOrder.CustomerNameTemp != "" {
			customerName = *m.OriginalOrder.CustomerNameTemp
		}
	}
	if customerName == "" && m.Note != "" {
		for _, part := range strings.Split(m.Note, "|") {
			part = strings.TrimSpace(part)
			if strings.HasPrefix(part, "\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32:") {
				parsed := strings.TrimSpace(strings.TrimPrefix(part, "\u0e25\u0e39\u0e01\u0e04\u0e49\u0e32:"))
				if parsed != "" {
					customerName = parsed
				}
			}
		}
	}

	orderNumber := ""
	if m.OriginalOrder != nil && m.OriginalOrder.OrderNumber != "" {
		orderNumber = m.OriginalOrder.OrderNumber
	} else if strings.HasPrefix(m.ClaimNo, "CLM-") {
		candidate := strings.TrimPrefix(m.ClaimNo, "CLM-")
		if candidate != "" && !strings.HasPrefix(candidate, "TEST") {
			orderNumber = candidate
		}
	}

	return CustomerClaimResponseDTO{
		ID:                     m.ID,
		ClaimNo:                m.ClaimNo,
		OriginalOrderID:        m.OriginalOrderID,
		OrderNumber:            orderNumber,
		CustomerName:           customerName,
		CustomerPhone:          m.CustomerPhone,
		ClaimType:              m.ClaimType,
		ClaimAmount:            m.ClaimAmount,
		RefundAmount:           m.RefundAmount,
		ReplacementCost:        m.ReplacementCost,
		ReturnID:               m.ReturnID,
		Status:                 m.Status,
		Notes:                  cleanNoteText(m.Note), // กรอง metadata ออก
		ClaimDate:              m.ClaimDate,
		CreatedBy:              m.CreatedBy,
		ApprovedBy:             m.ApprovedBy,
		SupplierResponseStatus: m.SupplierResponseStatus,
		CustomerReceivedItem:   m.CustomerReceivedItem,
		CustomerWaiting:        m.CustomerWaiting,
		OperationNote:          m.OperationNote,
		Items:                  items,
	}
}
