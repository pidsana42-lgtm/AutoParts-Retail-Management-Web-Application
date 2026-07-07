package import_data

import (
	"time"

	"backend/internal/app/entity"
)

// CreateBillDTO ใช้สำหรับรับข้อมูลเมื่อมีการสร้าง Bill ใหม่
type CreateBillDTO struct {
	TotalAmount        float64   `json:"total_amount" binding:"required"`
	BillNo             string    `json:"bill_no" binding:"required"`
	DueDate            time.Time `json:"due_date" binding:"required"`
	TransportBy        string    `json:"transport_by" binding:"required"`
	SupplierID         uint      `json:"supplier_id" binding:"required"`
	Subtotal           float64   `json:"subtotal" binding:"required"`
	BillImageID        uint      `json:"bill_image_id" binding:"required"`
	DiscountTotal      float64   `json:"discount_total"`
	CreditTerm         string    `json:"credit_term" binding:"required"`
	VatAmount          float64   `json:"vat_amount"`
	GrandTotal         float64   `json:"grand_total" binding:"required"`
	PaymentStatus      string    `json:"payment_status" binding:"required"`
	IsVerified         bool      `json:"is_verified"`
	VerifiedBy         uint      `json:"verified_by"`
	OCRText            string    `json:"ocr_text"`
	POID               uint      `json:"po_id" binding:"required"`
	EvidenceFileURL    string    `json:"evidence_file_url"`
	EvidenceUploadedAt time.Time `json:"evidence_uploaded_at"`
}

// UpdateBillDTO ใช้สำหรับรับข้อมูลเมื่อมีการแก้ไข Bill เดิม
type UpdateBillDTO struct {
	TotalAmount        float64   `json:"total_amount"`
	DueDate            time.Time `json:"due_date"`
	TransportBy        string    `json:"transport_by"`
	Subtotal           float64   `json:"subtotal"`
	DiscountTotal      float64   `json:"discount_total"`
	CreditTerm         string    `json:"credit_term"`
	VatAmount          float64   `json:"vat_amount"`
	GrandTotal         float64   `json:"grand_total"`
	PaymentStatus      string    `json:"payment_status"`
	IsVerified         *bool     `json:"is_verified,omitempty"` // ใช้ Pointer เพื่อให้เช็คค่า false ได้
	VerifiedBy         uint      `json:"verified_by"`
	OCRText            string    `json:"ocr_text"`
	EvidenceFileURL    string    `json:"evidence_file_url"`
	EvidenceUploadedAt time.Time `json:"evidence_uploaded_at"`
}

// BillResponseDTO ใช้สำหรับส่งข้อมูล Bill กลับไปให้ฝั่ง Frontend
type BillResponseDTO struct {
	ID                 uint      `json:"id"`
	TotalAmount        float64   `json:"total_amount"`
	BillNo             string    `json:"bill_no"`
	DueDate            time.Time `json:"due_date"`
	TransportBy        string    `json:"transport_by"`
	SupplierID         uint      `json:"supplier_id"`
	Subtotal           float64   `json:"subtotal"`
	BillImageID        uint      `json:"bill_image_id"`
	DiscountTotal      float64   `json:"discount_total"`
	CreditTerm         string    `json:"credit_term"`
	VatAmount          float64   `json:"vat_amount"`
	GrandTotal         float64   `json:"grand_total"`
	PaymentStatus      string    `json:"payment_status"`
	IsVerified         bool      `json:"is_verified"`
	VerifiedBy         uint      `json:"verified_by"`
	OCRText            string    `json:"ocr_text"`
	POID               uint      `json:"po_id"`
	EvidenceFileURL    string    `json:"evidence_file_url"`
	EvidenceUploadedAt time.Time `json:"evidence_uploaded_at"`
	CreatedAt          time.Time             `json:"created_at"`
	UpdatedAt          time.Time             `json:"updated_at"`
	BillItems          []BillItemResponseDTO `json:"bill_items,omitempty"`
	BillImage          *BillImageResponseDTO `json:"bill_image,omitempty"`
}

// ToEntity แปลงจาก CreateBillDTO เป็น entity.Bill สำหรับการบันทึกลง Database
func (d *CreateBillDTO) ToEntity() entity.Bill {
	return entity.Bill{
		TotalAmount:        d.TotalAmount,
		BillNo:             d.BillNo,
		DueDate:            d.DueDate,
		TransportBy:        d.TransportBy,
		SupplierID:         d.SupplierID,
		Subtotal:           d.Subtotal,
		BillImageID:        d.BillImageID,
		DiscountTotal:      d.DiscountTotal,
		CreditTerm:         d.CreditTerm,
		VatAmount:          d.VatAmount,
		GrandTotal:         d.GrandTotal,
		PaymentStatus:      d.PaymentStatus,
		IsVerified:         d.IsVerified,
		VerifiedBy:         d.VerifiedBy,
		OCRText:            d.OCRText,
		POID:               d.POID,
		EvidenceFileURL:    d.EvidenceFileURL,
		EvidenceUploadedAt: d.EvidenceUploadedAt,
	}
}

// ToEntity แปลงจาก UpdateBillDTO ไปอัปเดตค่าใน entity.Bill ตัวเดิม (ใช้สำหรับ Update)
func (d *UpdateBillDTO) ToEntity(existing entity.Bill) entity.Bill {
	if d.TotalAmount > 0 {
		existing.TotalAmount = d.TotalAmount
	}
	if !d.DueDate.IsZero() {
		existing.DueDate = d.DueDate
	}
	if d.TransportBy != "" {
		existing.TransportBy = d.TransportBy
	}
	if d.Subtotal > 0 {
		existing.Subtotal = d.Subtotal
	}
	if d.DiscountTotal > 0 {
		existing.DiscountTotal = d.DiscountTotal
	}
	if d.CreditTerm != "" {
		existing.CreditTerm = d.CreditTerm
	}
	if d.VatAmount > 0 {
		existing.VatAmount = d.VatAmount
	}
	if d.GrandTotal > 0 {
		existing.GrandTotal = d.GrandTotal
	}
	if d.PaymentStatus != "" {
		existing.PaymentStatus = d.PaymentStatus
	}
	if d.IsVerified != nil {
		existing.IsVerified = *d.IsVerified
	}
	if d.VerifiedBy > 0 {
		existing.VerifiedBy = d.VerifiedBy
	}
	if d.OCRText != "" {
		existing.OCRText = d.OCRText
	}
	if d.EvidenceFileURL != "" {
		existing.EvidenceFileURL = d.EvidenceFileURL
	}
	if !d.EvidenceUploadedAt.IsZero() {
		existing.EvidenceUploadedAt = d.EvidenceUploadedAt
	}
	return existing
}

// ToBillResponseDTO แปลงจาก entity.Bill เป็น BillResponseDTO เพื่อส่งคืนให้ Client
func ToBillResponseDTO(m *entity.Bill) BillResponseDTO {
	return BillResponseDTO{
		ID:                 m.ID,
		TotalAmount:        m.TotalAmount,
		BillNo:             m.BillNo,
		DueDate:            m.DueDate,
		TransportBy:        m.TransportBy,
		SupplierID:         m.SupplierID,
		Subtotal:           m.Subtotal,
		BillImageID:        m.BillImageID,
		DiscountTotal:      m.DiscountTotal,
		CreditTerm:         m.CreditTerm,
		VatAmount:          m.VatAmount,
		GrandTotal:         m.GrandTotal,
		PaymentStatus:      m.PaymentStatus,
		IsVerified:         m.IsVerified,
		VerifiedBy:         m.VerifiedBy,
		OCRText:            m.OCRText,
		POID:               m.POID,
		EvidenceFileURL:    m.EvidenceFileURL,
		EvidenceUploadedAt: m.EvidenceUploadedAt,
		CreatedAt:          m.CreatedAt,
		UpdatedAt:          m.UpdatedAt,
		BillItems: func() []BillItemResponseDTO {
			items := make([]BillItemResponseDTO, len(m.BillItems))
			for i := range m.BillItems {
				items[i] = ToBillItemResponseDTO(&m.BillItems[i])
			}
			return items
		}(),
		BillImage: func() *BillImageResponseDTO {
			if m.BillImage == nil {
				return nil
			}
			dto := ToBillImageResponseDTO(m.BillImage)
			return &dto
		}(),
	}
}