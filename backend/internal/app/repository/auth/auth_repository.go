package auth

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type UserRepository interface {
	GetByUsername(username string) (*entity.User, error)
	GetByLineUserID(lineUserID string) (*entity.User, error)
	GetByIdentifier(identifier string) (*entity.User, error)
	GetByID(id uint) (*entity.User, error)
	UpdateProfile(id uint, updates ProfileUpdates) (*entity.User, error)
	ValueExistsExcludingUser(column, value string, userID uint) (bool, error)
	UpdateProfileImage(id uint, path string) error
	UpdatePassword(id uint, passwordHash string) error
	SavePasswordReset(reset *entity.PasswordReset) error
	GetValidPasswordReset(userID uint, otp string) (*entity.PasswordReset, error)
	MarkPasswordResetUsed(resetID uint) error
}

type ProfileUpdates struct {
	Prefix            string
	FirstName         string
	LastName          string
	Email             string
	IDCardNumber      string
	LineUserID        string
	BankName          string
	BankAccountNumber string
	BankAccountName   string
	UpdateBank        bool
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) GetByUsername(username string) (*entity.User, error) {
	var user entity.User
	// ค้นหาผู้ใช้จาก username พร้อมดึงข้อมูลในตาราง Role พ่วงขึ้นมาด้วย
	err := r.db.Preload("Role").Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetByLineUserID(lineUserID string) (*entity.User, error) {
	var user entity.User
	// ค้นหาผู้ใช้จาก line_user_id พร้อมดึงข้อมูลในตาราง Role พ่วงขึ้นมาด้วย
	err := r.db.Preload("Role").Where("line_user_id = ?", lineUserID).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) GetByID(id uint) (*entity.User, error) {
	var user entity.User
	if err := r.db.Preload("Role").Preload("Bank").First(&user, id).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) UpdateProfile(id uint, updates ProfileUpdates) (*entity.User, error) {
	lineUserID := any(nil)
	if updates.LineUserID != "" {
		lineUserID = updates.LineUserID
	}
	values := map[string]any{
		"prefix":              updates.Prefix,
		"first_name":          updates.FirstName,
		"last_name":           updates.LastName,
		"email":               updates.Email,
		"id_card_number_user": updates.IDCardNumber,
		"line_user_id":        lineUserID,
	}
	if updates.UpdateBank {
		var bank entity.Bank
		if err := r.db.Where("bank_name = ?", updates.BankName).FirstOrCreate(&bank, entity.Bank{BankName: updates.BankName}).Error; err != nil {
			return nil, err
		}
		values["bank_id"] = bank.ID
		values["bank_account_number"] = updates.BankAccountNumber
		values["bank_account_name"] = updates.BankAccountName
	}
	if err := r.db.Model(&entity.User{}).Where("id = ?", id).Updates(values).Error; err != nil {
		return nil, err
	}
	return r.GetByID(id)
}

func (r *userRepository) ValueExistsExcludingUser(column, value string, userID uint) (bool, error) {
	var count int64
	if err := r.db.Model(&entity.User{}).Where(column+" = ? AND id <> ?", value, userID).Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (r *userRepository) UpdatePassword(id uint, passwordHash string) error {
	return r.db.Model(&entity.User{}).Where("id = ?", id).Update("password", passwordHash).Error
}

func (r *userRepository) UpdateProfileImage(id uint, path string) error {
	return r.db.Model(&entity.User{}).Where("id = ?", id).Update("profile_image_path", path).Error
}

func (r *userRepository) GetByIdentifier(identifier string) (*entity.User, error) {
	var user entity.User
	err := r.db.Preload("Role").Where("LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)", identifier, identifier).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) SavePasswordReset(reset *entity.PasswordReset) error {
	return r.db.Create(reset).Error
}

func (r *userRepository) GetValidPasswordReset(userID uint, otp string) (*entity.PasswordReset, error) {
	var reset entity.PasswordReset
	err := r.db.Where("user_id = ? AND otp = ? AND is_used = false AND expires_at > NOW()", userID, otp).
		Order("id DESC").First(&reset).Error
	if err != nil {
		return nil, err
	}
	return &reset, nil
}

func (r *userRepository) MarkPasswordResetUsed(resetID uint) error {
	return r.db.Model(&entity.PasswordReset{}).Where("id = ?", resetID).Update("is_used", true).Error
}
