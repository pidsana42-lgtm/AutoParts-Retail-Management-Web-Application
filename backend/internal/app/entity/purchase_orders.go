package entity

import (
	"time"
	"gorm.io/gorm"
	"backend/internal/app/enum"
)

type PO struct {
	gorm.Model
	PO_number    string        `gorm:"type:varchar(100);uniqueIndex;not null" json:"po_number"`
	Status       enum.POStatus `gorm:"type:varchar(50);default:'DRAFT';not null" json:"status"`
	Total_amount float64       `gorm:"type:decimal(10,2);not null;default:0" json:"total_amount"`
	Notes        *string       `gorm:"type:text" json:"notes"`

	LastUpdatedBy 	 *uint      `gorm:"column:last_updated_by" json:"last_updated_by,omitempty"`
	UpdatedByUser 	 *User      `gorm:"foreignKey:LastUpdatedBy" json:"updated_by_user,omitempty"`
	Created_by  	 uint       `json:"created_by"`
	Creator     	 User       `gorm:"foreignKey:Created_by" json:"creator"`
	Approved_by 	 *uint      `json:"approved_by"`
	Approved_at 	 *time.Time `json:"approved_at"`
	// เวลาที่แจ้งเตือน PO ค้างครั้งล่าสุด (ใช้คู่กับ UpdatedAt เพื่อนับ 7 วันจากความเคลื่อนไหวล่าสุด ไม่ใช่แค่วันที่สร้าง)
	LastReminderAt   *time.Time `json:"last_reminder_at"`

	SupplierID 		 uint 		`json:"supplier_id"`
	Supplier   		 Supplier 	`gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	PO_type_id 		 uint    	`json:"po_type_id"`
	PO_Type    		 POType 	`gorm:"foreignKey:PO_type_id" json:"po_type,omitempty"`
	PO_Items     	 []POItems `gorm:"foreignKey:POID" json:"po_items,omitempty"`
	ReceiveEvidenceExcels []ReceiveEvidenceExcel `gorm:"foreignKey:POID" json:"receive_evidence_excels,omitempty"`
}

func (PO) TableName() string {
	return "purchase_orders"
}