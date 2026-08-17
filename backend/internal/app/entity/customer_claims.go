package entity
import "gorm.io/gorm"
import "time"
type CustomerClaim struct {
	gorm.Model
	OriginalOrderID uint `gorm:"not null" json:"original_order_id"`
	OriginalOrder *SaleOrder `gorm:"foreignKey:OriginalOrderID" json:"original_order,omitempty"`
	ReturnID *uint `gorm:"default:null" json:"return_id"`
	Return *SalesReturn `gorm:"foreignKey:ReturnID" json:"return,omitempty"`
	CreatedBy uint `gorm:"not null" json:"created_by"`
	CreatedByUser *User `gorm:"foreignKey:CreatedBy" json:"created_by_user,omitempty"`
	ApprovedBy *uint `gorm:"index" json:"approved_by"`
	ApprovedByUser *User `gorm:"foreignKey:ApprovedBy" json:"approved_by_user,omitempty"`
	ClaimNo string `gorm:"index" json:"claim_no"`
	Status  string `gorm:"not null" json:"status"`
	Note string `gorm:"type:text" json:"note"`
	ClaimDate time.Time          `gorm:"not null" json:"claim_date"`
	CustomerName    string       `gorm:"size:255" json:"customer_name"`
	CustomerPhone   string       `gorm:"size:50" json:"customer_phone"`
	ClaimType       string       `gorm:"size:50" json:"claim_type"`
	ClaimAmount     float64      `gorm:"type:decimal(15,2);default:0" json:"claim_amount"`
	RefundAmount    float64      `gorm:"type:decimal(15,2);default:0" json:"refund_amount"`
	ReplacementCost float64      `gorm:"type:decimal(15,2);default:0" json:"replacement_cost"`
	// สถานะการดำเนินงาน
	SupplierResponseStatus string `gorm:"size:20;default:null" json:"supplier_response_status"` // WAITING, APPROVED, REJECTED
	CustomerReceivedItem   *bool  `gorm:"default:null" json:"customer_received_item"`           // ลูกค้าได้รับของแล้วหรือยัง
	CustomerWaiting        bool   `gorm:"default:false" json:"customer_waiting"`                  // ลูกค้ารอผลอยู่ (ยังไม่รับของ)
	OperationNote          string `gorm:"type:text" json:"operation_note"`                       // บันทึกการดำเนินงาน
	Items     []CustomerClaimItem `gorm:"foreignKey:CustomerClaimID" json:"items,omitempty"`
}

	