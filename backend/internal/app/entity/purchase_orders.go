package entity

import (
	"time"

	"gorm.io/gorm"
)

type POStatus string

const (
	StatusDraft    POStatus = "DRAFT"
	StatusPending  POStatus = "PENDING"
	StatusApproved POStatus = "APPROVED"
	StatusRejected POStatus = "REJECTED"
)

type PO struct {
	gorm.Model
	PO_number        string     `gorm:"type:varchar(100);uniqueIndex;not null" json:"po_number"`
	Status           POStatus   `gorm:"type:varchar(50);default:'DRAFT';not null" json:"status"`
	Expires_at       *time.Time `json:"expires_at"`
	Pdf_url          string     `gorm:"type:text" json:"pdf_url"`
	Pdf_generated_at *time.Time `json:"pdf_generated_at"`
	Notes            *string    `gorm:"type:text" json:"notes"`

	Created_by  	 uint       `json:"created_by"`
	Approved_by 	 *uint      `json:"approved_by"`
	Approved_at 	 *time.Time `json:"approved_at"`

	SupplierID 		 uint 		`json:"supplier_id"`
	Supplier   		 Supplier 	`gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	PO_type_id 		 uint    	`json:"po_type_id"`
	PO_Type    		 PO_Type 	`gorm:"foreignKey:PO_type_id" json:"po_type,omitempty"`
}

func (PO) TableName() string {
	return "purchase_orders"
}
