package entity

import (
	"time"

	"gorm.io/gorm"
)

type BillImportJob struct {
	gorm.Model
	FileURL         string     `gorm:"type:text;not null" json:"file_url"`
	FileType        string     `gorm:"type:varchar(20);not null" json:"file_type"`
	Status          string     `gorm:"type:varchar(30);not null;default:'processed'" json:"status"`
	RawModelOutput  string     `gorm:"type:text" json:"raw_model_output"`
	DraftJSON       string     `gorm:"type:text" json:"draft_json"`
	ErrorMessage    string     `gorm:"type:text" json:"error_message"`
	CreatedBy       uint       `gorm:"not null;index" json:"created_by"`
	CreatedByUser   *User      `gorm:"foreignKey:CreatedBy" json:"created_by_user,omitempty"`
	ConfirmedBillID *uint      `gorm:"index" json:"confirmed_bill_id,omitempty"`
	ConfirmedBill   *Bill      `gorm:"foreignKey:ConfirmedBillID" json:"confirmed_bill,omitempty"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
}
