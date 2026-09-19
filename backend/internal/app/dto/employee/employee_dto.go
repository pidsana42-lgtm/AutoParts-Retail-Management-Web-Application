package employee

import "time"

type CreateEmployeeRequest struct {
	Role              string `json:"role" binding:"required,oneof=Employee Manager"`
	Prefix            string `json:"prefix" binding:"required,max=20"`
	FirstName         string `json:"first_name" binding:"required,max=100"`
	LastName          string `json:"last_name" binding:"required,max=100"`
	IDCardNumber      string `json:"id_card_number_user" binding:"required,len=13,numeric"`
	Username          string `json:"username" binding:"required,min=4,max=100"`
	Password          string `json:"password" binding:"required,min=8,max=72"`
	LineUserID        string `json:"line_user_id" binding:"omitempty,max=100"`
	BankID            uint   `json:"bank_id" binding:"omitempty"`
	BankName          string `json:"bank_name" binding:"omitempty,max=100"`
	BankAccountNumber string `json:"bank_account_number" binding:"required,max=50"`
	BankAccountName   string `json:"bank_account_name" binding:"omitempty,max=255"`
}

type EmployeeResponse struct {
	ID               uint      `json:"id"`
	FirstName        string    `json:"first_name"`
	LastName         string    `json:"last_name"`
	Username         string    `json:"username"`
	Role             string    `json:"role"`
	BankName         string    `json:"bank_name"`
	AccountEnd       string    `json:"account_end"`
	AccountMasked    string    `json:"account_masked"`
	LineConnected    bool      `json:"line_connected"`
	CreatedAt        time.Time `json:"created_at"`
	ProfileImagePath string    `json:"profile_image_path"`
}

type EmployeeListResponse struct {
	Employees []EmployeeResponse `json:"employees"`
	Total     int                `json:"total"`
}

type VerifyEmployeeDetailsRequest struct {
	Password string `json:"password" binding:"required,max=72"`
}

type UpdateEmployeeRequest struct {
	Role              string `json:"role" binding:"required,oneof=Employee Manager"`
	Prefix            string `json:"prefix" binding:"required,max=20"`
	FirstName         string `json:"first_name" binding:"required,max=100"`
	LastName          string `json:"last_name" binding:"required,max=100"`
	IDCardNumber      string `json:"id_card_number_user" binding:"required,len=13,numeric"`
	LineUserID        string `json:"line_user_id" binding:"omitempty,max=100"`
	BankID            uint   `json:"bank_id" binding:"omitempty"`
	BankName          string `json:"bank_name" binding:"omitempty,max=100"`
	BankAccountNumber string `json:"bank_account_number" binding:"required,max=50"`
	BankAccountName   string `json:"bank_account_name" binding:"omitempty,max=255"`
	Password          string `json:"password" binding:"required,max=72"`
}

type EmployeeDetailResponse struct {
	ID                uint      `json:"id"`
	Prefix            string    `json:"prefix"`
	FirstName         string    `json:"first_name"`
	LastName          string    `json:"last_name"`
	IDCardNumber      string    `json:"id_card_number_user"`
	Username          string    `json:"username"`
	LineUserID        string    `json:"line_user_id"`
	Role              string    `json:"role"`
	BankName          string    `json:"bank_name"`
	BankAccountNumber string    `json:"bank_account_number"`
	BankAccountName   string    `json:"bank_account_name"`
	CreatedAt         time.Time `json:"created_at"`
	ProfileImagePath  string    `json:"profile_image_path"`
}

type BankOption struct {
	ID   uint   `json:"id"`
	Name string `json:"name"`
}

type RegistrationMetadata struct {
	Banks []BankOption `json:"banks"`
}
