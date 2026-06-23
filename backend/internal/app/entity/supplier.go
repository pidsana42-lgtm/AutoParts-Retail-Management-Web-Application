package entity

import "gorm.io/gorm"

type Supplier struct {
	gorm.Model
	SupplierName      string `gorm:"type:varchar(100);not null;uniqueindex" json:"supplier_name" binding:"required"`
	SupplierAddress   string `gorm:"type:varchar(255);not null;" json:"supplier_address" binding:"required"`
	ContactLineSale   string `gorm:"type:varchar(100);not null;" json:"contact_line_sale" binding:"required"`
	PhoneNumberSale   string `gorm:"type:varchar(20);not null;" json:"phone_number_sale" binding:"required"`
	EmailSale         string `gorm:"type:varchar(100);not null;uniqueindex" json:"email_sale" binding:"required"`
	BankAccountNumber string `gorm:"type:varchar(50);not null;" json:"bank_account_number" binding:"required"`
	ShortSupplierName string `gorm:"type:varchar(50);not null;" json:"short_supplier_name" binding:"required"`
	Bill []Bill `gorm:"foreignKey:SupplierID" json:"bill,omitempty"`
}
