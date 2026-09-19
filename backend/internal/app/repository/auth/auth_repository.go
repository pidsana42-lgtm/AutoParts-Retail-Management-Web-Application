package auth

import (
    "backend/internal/app/entity"
    "gorm.io/gorm"
)

type UserRepository interface {
    GetByUsername(username string) (*entity.User, error)
    GetByLineUserID(lineUserID string) (*entity.User, error)
    GetByIdentifier(identifier string) (*entity.User, error)
    UpdatePassword(userID uint, hashedPassword string) error
    SavePasswordReset(reset *entity.PasswordReset) error
    GetValidPasswordReset(userID uint, otp string) (*entity.PasswordReset, error)
    MarkPasswordResetUsed(resetID uint) error
}

type userRepository struct {
    db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) GetByUsername(username string) (*entity.User, error) {
    var user entity.User
    err := r.db.Preload("Role").Where("username = ?", username).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) GetByLineUserID(lineUserID string) (*entity.User, error) {
    var user entity.User
    err := r.db.Preload("Role").Where("line_user_id = ?", lineUserID).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) GetByIdentifier(identifier string) (*entity.User, error) {
    var user entity.User
    err := r.db.Preload("Role").Where("username = ? OR email = ?", identifier, identifier).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) UpdatePassword(userID uint, hashedPassword string) error {
    return r.db.Model(&entity.User{}).Where("id = ?", userID).Update("password", hashedPassword).Error
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