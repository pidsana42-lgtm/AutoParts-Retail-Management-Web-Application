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
	UnitPrice       float64 `json:"unit_price" binding:"gte=0"`
	Reason          string  `json:"reason" binding:"required"`
	Resolution      string  `json:"resolution"`
	ClaimType       string  `json:"claim_type"`
	EvidenceURL     string  `json:"evidence_url"`
}

// UpdateCustomerClaimItemDTO ใช้สำหรับอัปเดตรายการสินค้า
type UpdateCustomerClaimItemDTO struct {
	Qty         float64 `json:"qty" binding:"gte=0"`
	UnitPrice   float64 `json:"unit_price" binding:"gte=0"`
	Reason      string  `json:"reason"`
	Resolution  string  `json:"resolution"`
	Status      string  `json:"status"`
	ClaimType   string  `json:"claim_type"`
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
	ProductCode     string  `json:"product_code,omitempty"`
	Qty             float64 `json:"qty"`
	UnitPrice       float64 `json:"unit_price"`
	Reason          string  `json:"reason"`
	Resolution      string  `json:"resolution"`
	Status          string  `json:"status"`
	ClaimType       string  `json:"claim_type"`
	EvidenceURL     string  `json:"evidence_url"`
	// ทั้ง 3 นี้บอกว่ารายการนี้เคยมีผลจริงต่อสต็อก/บัญชีเชื่อไปแล้วหรือยัง (ไม่ว่า Status ปัจจุบัน
	// จะเป็นอะไร) — ฝั่ง frontend ใช้ตัดสินว่าลบใบเคลมนี้ได้เลยไหม หรือต้องยกเลิกแทนถึงจะย้อนกลับได้
	// (ต้องตรงกับเงื่อนไขบล็อกลบจริงใน repository.DeleteCustomerClaim ไม่งั้นปุ่มจะโชว์ผิดจากที่ backend อนุญาต)
	StockOutIssued  bool `json:"stock_out_issued"`
	StockInReceived bool `json:"stock_in_received"`
	CreditApplied   bool `json:"credit_applied"`
}

func (d *CreateCustomerClaimItemDTO) ToEntity() entity.CustomerClaimItem {
	var customerClaimID uint
	if d.CustomerClaimID != nil {
		customerClaimID = *d.CustomerClaimID
	}
	claimType := d.ClaimType
	if claimType == "" {
		claimType = "INSTANT"
	}
	return entity.CustomerClaimItem{
		CustomerClaimID: customerClaimID,
		ReturnedItemID:  d.ReturnItemID,
		ProductID:       d.ProductID,
		Qty:             uint(d.Qty),
		UnitPrice:       d.UnitPrice,
		Reason:          d.Reason,
		Resolution:      d.Resolution,
		Status:          "Pending",
		ClaimType:       claimType,
		EvidenceURL:     d.EvidenceURL,
	}
}

func ToCustomerClaimItemResponseDTO(m *entity.CustomerClaimItem) CustomerClaimItemResponseDTO {
	returnedItemID := m.ReturnedItemID
	var productName string
	var productCode string
	if m.Product != nil {
		productName = m.Product.Product_Name
		productCode = m.Product.Product_Code
	}
	status := m.Status
	if status == "" {
		status = "Pending"
	}
	claimType := m.ClaimType
	if claimType == "" {
		claimType = "INSTANT"
	}
	return CustomerClaimItemResponseDTO{
		ID:              m.ID,
		CustomerClaimID: m.CustomerClaimID,
		ReturnItemID:    returnedItemID,
		ProductID:       m.ProductID,
		ProductName:     productName,
		ProductCode:     productCode,
		Qty:             float64(m.Qty),
		UnitPrice:       m.UnitPrice,
		Reason:          m.Reason,
		Resolution:      m.Resolution,
		Status:          status,
		ClaimType:       claimType,
		EvidenceURL:     m.EvidenceURL,
		StockOutIssued:  m.StockOutIssued,
		StockInReceived: m.StockInReceived,
		CreditApplied:   m.CreditApplied,
	}
}
