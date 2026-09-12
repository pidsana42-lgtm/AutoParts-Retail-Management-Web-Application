package entity

import (
	"time"

	"gorm.io/gorm"
)

type Bill struct {
	gorm.Model
	// PriceChangeDetected: ไม่ persist ลง DB — ตั้งไว้ระหว่าง ConfirmBillImportTransaction เพื่อบอก
	// service layer ว่าบิลนี้มีราคาทุนสินค้าที่ต่างจากระบบหรือไม่ (ไม่ว่าจะ auto-approve แล้วหรือรออนุมัติ)
	// ใช้ตัดสินใจว่าต้องแจ้งเตือนเจ้าของร้านหรือไม่
	PriceChangeDetected   bool                   `gorm:"-" json:"-"`
	TotalAmount           float64                `gorm:"not null" json:"total_amount"`
	BillNo                string                 `gorm:"unique;not null" json:"bill_no"`
	DueDate               time.Time              `gorm:"not null" json:"due_date"`
	CreditTerm            string                 `gorm:"type:varchar(50);not null;default:'30 Days'" json:"credit_term"`
	TransportBy           string                 `gorm:"not null" json:"transport_by"`
	SupplierID            uint                   `gorm:"not null;index" json:"supplier_id"`
	Supplier              *Supplier              `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	Subtotal              float64                `gorm:"not null" json:"subtotal"`
	BillImageID           *uint                  `gorm:"index" json:"bill_image_id"`
	BillImage             *BillImage             `gorm:"foreignKey:BillImageID" json:"bill_image,omitempty"`
	DiscountTotal         float64                `gorm:"not null" json:"discount_total"`
	ReceiveDate           time.Time              `gorm:"default:CURRENT_TIMESTAMP" json:"receive_date"`
	VatAmount             float64                `gorm:"not null" json:"vat_amount"`
	GrandTotal            float64                `gorm:"not null" json:"grand_total"`
	PaymentStatus         string                 `gorm:"not null" json:"payment_status"`
	IsVerified            bool                   `gorm:"not null" json:"is_verified"`
	VerifiedBy            uint                   `gorm:"not null;index" json:"verified_by"`
	VerifiedByUser        *User                  `gorm:"foreignKey:VerifiedBy" json:"verified_by_user,omitempty"`
	OCRText               string                 `gorm:"type:text" json:"ocr_text"`
	POID                  *uint                  `gorm:"index" json:"po_id"`
	PO                    *PO                    `gorm:"foreignKey:POID" json:"po,omitempty"`
	EvidenceFileURL       string                 `gorm:"type:text" json:"evidence_file_url"`
	EvidenceUploadedAt    time.Time              `json:"evidence_uploaded_at"`
	BillItems             []BillItem             `gorm:"foreignKey:BillID" json:"bill_items,omitempty"`
	Items                 []BillItem             `gorm:"foreignKey:BillID" json:"items,omitempty"`
	ReceiveEvidenceExcels []ReceiveEvidenceExcel `gorm:"foreignKey:POID" json:"receive_evidence_excels,omitempty"`

	// Toto WMS
	StockMovements []StockMovement `gorm:"foreignKey:BillID" json:"stock_movements,omitempty"`
}
