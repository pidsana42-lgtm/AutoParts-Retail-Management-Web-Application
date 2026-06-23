package entity
import "gorm.io/gorm"
import "time"
type CustomerClaim struct {
	gorm.Model
	OriginalOrderID uint `gorm:"not null" json:"original_order_id"`
	OriginalOrder *SaleOrder `gorm:"foreignKey:OriginalOrderID" json:"original_order,omitempty"`
	ReturnID uint `gorm:"not null" json:"return_id"`
	Return *SalesReturn `gorm:"foreignKey:ReturnID" json:"return,omitempty"`
	CreatedBy uint `gorm:"not null" json:"created_by"`
	CreatedByUser *User `gorm:"foreignKey:CreatedBy" json:"created_by_user,omitempty"`
	ApprovedBy *uint `gorm:"index" json:"approved_by"`
	ApprovedByUser *User `gorm:"foreignKey:ApprovedBy" json:"approved_by_user,omitempty"`
	Status string `gorm:"not null" json:"status"`
	Note string `gorm:"type:text" json:"note"`
	ClaimDate time.Time `gorm:"not null" json:"claim_date"`
}

	