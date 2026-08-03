package entity
import "gorm.io/gorm"
type CustomerClaimItem struct {
	gorm.Model
	CustomerClaimID uint           `gorm:"not null;index" json:"customer_claim_id"`
	CustomerClaim   *CustomerClaim `gorm:"foreignKey:CustomerClaimID" json:"customer_claim,omitempty"`
	ReturnedItemID *uint `gorm:"default:null;index" json:"returned_item_id"`
	ReturnedItem   *SalesReturnItem `gorm:"foreignKey:ReturnedItemID" json:"returned_item,omitempty"`
	ProductID uint `gorm:"not null;index" json:"product_id"`
	Product   *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	Qty uint `gorm:"not null" json:"qty"`
	Reason string `gorm:"type:text" json:"reason"`
	Resolution string `gorm:"type:text" json:"resolution"`
	Status     string `gorm:"default:'Pending'" json:"status"`
	EvidenceURL string `gorm:"type:text" json:"evidence_url"`
}