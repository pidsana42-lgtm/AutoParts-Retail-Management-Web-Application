package company_setting

type CompanySettingReq struct {
	CompanyName     string `json:"company_name" binding:"required"`
	TaxIDNumber     string `json:"tax_id_number" binding:"required"`
	Address         string `json:"address" binding:"required"`
	PhoneNumber     string `json:"phone_number" binding:"required"`
	Email           string `json:"email"`
	LogoURL         string `json:"logo_url"`
	PromptPayType   string `json:"promptpay_type"`
	PromptPayNumber string `json:"promptpay_number"`
	PromptPayName   string `json:"promptpay_name"`
	BankName          string `json:"bank_name"`
	BankAccountNumber string `json:"bank_account_number"`
	BankAccountName   string `json:"bank_account_name"`
}

type CompanySettingResponse struct {
	ID                    uint   `json:"id"`
	CompanyName           string `json:"company_name"`
	TaxIDNumber           string `json:"tax_id_number"`
	Address               string `json:"address"`
	PhoneNumber           string `json:"phone_number"`
	Email                 string `json:"email"`
	LogoURL               string `json:"logo_url"`
	PromptPayType         string `json:"promptpay_type"`
	PromptPayNumberMasked string `json:"promptpay_number_masked"`
	PromptPayName         string `json:"promptpay_name"`
	HasPromptPay          bool   `json:"has_promptpay"`
	BankName                string `json:"bank_name"`
	BankAccountNumber       string `json:"bank_account_number"`
	BankAccountNumberMasked string `json:"bank_account_number_masked"`
	BankAccountName         string `json:"bank_account_name"`
	HasBankAccount          bool   `json:"has_bank_account"`
}

type PaymentSettingRevealResponse struct {
	PromptPayNumber   string `json:"promptpay_number"`
	PromptPayType     string `json:"promptpay_type"`
	PromptPayName     string `json:"promptpay_name"`
	BankAccountNumber string `json:"bank_account_number"`
	BankName          string `json:"bank_name"`
	BankAccountName   string `json:"bank_account_name"`
}


