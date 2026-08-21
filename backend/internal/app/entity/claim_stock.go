package entity

import (
	"gorm.io/gorm"
)

type ClaimStock struct {
	gorm.Model
	ProductID       uint      `json:"product_id"`
	Product         *Product  `gorm:"foreignKey:ProductID" json:"product"`
	
	Quantity        int       `json:"quantity"` // จำนวนของเสีย
	
	CustomerClaimID *uint     `json:"customer_claim_id"` // อ้างอิงใบเคลมลูกค้า (สามารถ null ได้เผื่อเป็นของเสียจากสาเหตุอื่น)
	CustomerClaim   *CustomerClaim `gorm:"foreignKey:CustomerClaimID" json:"customer_claim"`

	Status          string    `json:"status" gorm:"default:'WAITING_SUPPLIER'"` // สถานะเช่น "WAITING_SUPPLIER", "SENT_TO_SUPPLIER", "SCRAPPED"
	
	Note            string    `json:"note"` // บันทึกเพิ่มเติม
	
	SupplierClaimID *uint     `json:"supplier_claim_id"` // ลิงค์ไปยัง SupplierClaim ถ้าส่งไปเคลมบริษัทแล้ว
	SupplierClaim   *SupplierClaim `gorm:"foreignKey:SupplierClaimID" json:"supplier_claim"`
}
