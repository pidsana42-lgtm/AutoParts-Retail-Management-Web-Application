package claim

import (
	"backend/internal/app/entity"
)

// CreateCustomerClaimItemDTO ใช้สำหรับรับข้อมูลสินค้า 1 ชิ้นที่จะเคลม
type CreateCustomerClaimItemDTO struct {
	CustomerClaimID *uint   `json:"customer_claim_id"`
	ReturnItemID    *uint   `json:"return_item_id"`
	ProductID       uint    `json:"product_id" binding:"required"`
	Qty             float64 `json:"qty" binding:"required,gt=0"`
	Reason          string  `json:"reason" binding:"required"`
	Resolution      string  `json:"resolution"`
	EvidenceURL     string  `json:"evidence_url"`
}

// UpdateCustomerClaimItemDTO ใช้สำหรับอัปเดตรายการสินค้า
type UpdateCustomerClaimItemDTO struct {
	Qty         float64 `json:"qty"`
	Reason      string  `json:"reason"`
	Resolution  string  `json:"resolution"`
	EvidenceURL string  `json:"evidence_url"`
}

// UpdateClaimItemStatusDTO ใช้สำหรับอนุมัติ/ปฏิเสธรายการสินค้ารายชิ้น
type UpdateClaimItemStatusDTO struct {
	Status string `json:"status" binding:"required"`
}

// CustomerClaimItemResponseDTO ใช้แสดงผลรายการเคลม
type CustomerClaimItemResponseDTO struct {
	ID              uint    `json:"id"`
	CustomerClaimID uint    `json:"customer_claim_id"`
	ReturnItemID    *uint   `json:"return_item_id"`
	ProductID       uint    `json:"product_id"`
	ProductName     string  `json:"product_name"`
	Qty             float64 `json:"qty"`
	Reason          string  `json:"reason"`
	Resolution      string  `json:"resolution"`
	Status          string  `json:"status"`
	EvidenceURL     string  `json:"evidence_url"`
}

func (d *CreateCustomerClaimItemDTO) ToEntity() entity.CustomerClaimItem {
	var customerClaimID uint
	if d.CustomerClaimID != nil {
		customerClaimID = *d.CustomerClaimID
	}
	return entity.CustomerClaimItem{
		CustomerClaimID: customerClaimID,
		ReturnedItemID:  d.ReturnItemID,
		ProductID:       d.ProductID,
		Qty:             uint(d.Qty),
		Reason:          d.Reason,
		Resolution:      d.Resolution,
		Status:          "Pending",
		EvidenceURL:     d.EvidenceURL,
	}
}

func ToCustomerClaimItemResponseDTO(m *entity.CustomerClaimItem) CustomerClaimItemResponseDTO {
	returnedItemID := m.ReturnedItemID
	var productName string
	if m.Product != nil {
		productName = m.Product.Product_Name
	}
	status := m.Status
	if status == "" {
		status = "Pending"
	}
	return CustomerClaimItemResponseDTO{
		ID:              m.ID,
		CustomerClaimID: m.CustomerClaimID,
		ReturnItemID:    returnedItemID,
		ProductID:       m.ProductID,
		ProductName:     productName,
		Qty:             float64(m.Qty),
		Reason:          m.Reason,
		Resolution:      m.Resolution,
		Status:          status,
		EvidenceURL:     m.EvidenceURL,
	}
}
