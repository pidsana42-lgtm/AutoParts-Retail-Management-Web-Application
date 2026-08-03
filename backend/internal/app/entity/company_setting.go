package entity

import "gorm.io/gorm"

type CompanySetting struct {
	gorm.Model
	CompanyName			string 			`gorm:"type:varchar(255);not null" json:"company_name"`
	TaxIDNumber			string 			`gorm:"type:varchar(255);not null" json:"tax_id_number"`
	Address				string			`gorm:"type:text;not null" json:"address"`
	PhoneNumber			string			`gorm:"type:varchar(50);not null" json:"phone_number"`
	Email				string			`gorm:"type:varchar(100);not null" json:"email"`
	LogoURL				string			`gorm:"type:text;not null" json:"logo_url"`
}

func (CompanySetting) TableName() string {
	return "company_setting"
}