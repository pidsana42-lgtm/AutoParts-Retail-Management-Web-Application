package auth

type ProfileResponse struct {
	ID                uint   `json:"id"`
	Prefix            string `json:"prefix"`
	FirstName         string `json:"first_name"`
	LastName          string `json:"last_name"`
	Username          string `json:"username"`
	Role              string `json:"role"`
	ProfileImagePath  string `json:"profile_image_path"`
	IDCardNumber      string `json:"id_card_number_user"`
	LineUserID        string `json:"line_user_id"`
	BankID            uint   `json:"bank_id"`
	BankName          string `json:"bank_name"`
	BankAccountNumber string `json:"bank_account_number"`
	BankAccountName   string `json:"bank_account_name"`
}

type UpdateProfileRequest struct {
	Prefix            string `json:"prefix"`
	FirstName         string `json:"first_name" binding:"required"`
	LastName          string `json:"last_name" binding:"required"`
	IDCardNumber      string `json:"id_card_number_user" binding:"required"`
	LineUserID        string `json:"line_user_id"`
	BankName          string `json:"bank_name"`
	BankAccountNumber string `json:"bank_account_number"`
	BankAccountName   string `json:"bank_account_name"`
}

type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password" binding:"required"`
	NewPassword     string `json:"new_password" binding:"required"`
}
