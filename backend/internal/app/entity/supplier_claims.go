package entity
import "time"
import "gorm.io/gorm"
type SupplierClaim struct {
	gorm.Model
	Note string `gorm:"type:text" json:"note"`
	ClaimDate time.Time `gorm:"not null" json:"claim_date"`
	Status string `gorm:"not null" json:"status"`
	ApprovedBy uint `gorm:"type:text" json:"approved_by"`
	ApproveBy  *User `gorm:"foreignKey:ApprovedBy" json:"approve_by,omitempty"`
	CreatedBy uint `gorm:"not null" json:"created_by"`
	CreatedByUser *User `gorm:"foreignKey:CreatedBy" json:"created_by_user,omitempty"`
	PurchaseOrderID uint `gorm:"not null" json:"purchase_order_id"`
	PurchaseOrder *PurchaseOrder `gorm:"foreignKey:PurchaseOrderID" json:"purchase_order,omitempty"`
	SupplierID uint `gorm:"not null" json:"supplier_id"`
	Supplier *Supplier `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
}