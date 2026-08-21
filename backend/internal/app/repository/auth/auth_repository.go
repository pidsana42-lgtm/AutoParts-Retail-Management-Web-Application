package auth

import (
    "backend/internal/app/entity"
    "gorm.io/gorm"
)

type UserRepository interface {
    GetByUsername(username string) (*entity.User, error)
    GetByLineUserID(lineUserID string) (*entity.User, error)
    GetByID(id uint) (*entity.User, error)
    GetByQrLoginToken(token string) (*entity.User, error)
    UpdateQrLoginToken(userID uint, token string) error
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
    err := r.db.Preload("Role").First(&user, id).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

// GetByQrLoginToken ใช้ตอนพนักงานสแกน QR ส่วนตัวจากมือถือ (ยังไม่ล็อกอิน จึงต้องหาจาก token อย่างเดียว)
func (r *userRepository) GetByQrLoginToken(token string) (*entity.User, error) {
    var user entity.User
    err := r.db.Preload("Role").Where("qr_login_token = ? AND qr_login_token <> ''", token).First(&user).Error
    if err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) UpdateQrLoginToken(userID uint, token string) error {
    return r.db.Model(&entity.User{}).Where("id = ?", userID).Update("qr_login_token", token).Error
}