package company_setting

type CompanySettingReq struct {
	CompanyName string `json:"company_name" binding:"required"`
	TaxIDNumber string `json:"tax_id_number" binding:"required"`
	Address     string `json:"address" binding:"required"`
	PhoneNumber string `json:"phone_number" binding:"required"`
	Email       string `json:"email"`
	LogoURL     string `json:"logo_url"`
}

type CompanySettingResponse struct {
	ID          uint   `json:"id"`
	CompanyName string `json:"company_name"`
	TaxIDNumber string `json:"tax_id_number"`
	Address     string `json:"address"`
	PhoneNumber string `json:"phone_number"`
	Email       string `json:"email"`
	LogoURL     string `json:"logo_url"`
}
