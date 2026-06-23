package entity

import "gorm.io/gorm"

type ReceiveEvidenceExcel struct {
	gorm.Model
	Filepath string `gorm:"type:text;not null;unique" json:"file_path"`
	BillID   uint   `gorm:"column:bill_id" json:"bill_id"`
	POID     uint   `gorm:"column:po_id" json:"po_id"`

	Bill 	 Bill	`gorm:"foreignKey:BillID" json:"bill,omitempty"`
	PO 		 PO 	`gorm:"foreignKey:POID" json:"po,omitempty"`
}

func (ReceiveEvidenceExcel) TableName() string {
	return "receive_evidence_excel"
}
