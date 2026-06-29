package wms

import "time"

type SupplierRequestDTO struct {
	SupplierName      string `json:"supplier_name" binding:"required"`
	SupplierAddress   string `json:"supplier_address" binding:"required"`
	ContactLineSale   string `json:"contact_line_sale" binding:"required"`
	PhoneNumberSale   string `json:"phone_number_sale" binding:"required"`
	EmailSale         string `json:"email_sale" binding:"required,email"`
	BankAccountNumber string `json:"bank_account_number" binding:"required"`
	ShortSupplierName string `json:"short_supplier_name" binding:"required"`
}

type SupplierResponseDTO struct {
	ID                uint      `json:"id"`
	SupplierName      string    `json:"supplier_name"`
	SupplierAddress   string    `json:"supplier_address"`
	ContactLineSale   string    `json:"contact_line_sale"`
	PhoneNumberSale   string    `json:"phone_number_sale"`
	EmailSale         string    `json:"email_sale"`
	BankAccountNumber string    `json:"bank_account_number"`
	ShortSupplierName string    `json:"short_supplier_name"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
