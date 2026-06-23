package entity
import "gorm.io/gorm"
type SupplierClaimItem struct {
	gorm.Model
	SupplierClaimID uint `gorm:"not null;index"`
	SupplierClaim   *SupplierClaim `gorm:"foreignKey:SupplierClaimID" json:"supplier_claim,omitempty"`
	ProductID uint `gorm:"not null;index"`
	Product   *Product `gorm:"foreignKey:ProductID" json:"product,omitempty"`
	CustomerClaimItemID uint `gorm:"not null;index"`
	CustomerClaimItem   *CustomerClaimItem `gorm:"foreignKey:CustomerClaimItemID" json:"customer_claim_item,omitempty"`
	Qty uint `gorm:"not null" json:"qty"`
	Resolution string `gorm:"type:text" json:"resolution"`
	ClaimType string `gorm:"not null" json:"claim_type"`
	Reason string `gorm:"type:text" json:"reason"`
}