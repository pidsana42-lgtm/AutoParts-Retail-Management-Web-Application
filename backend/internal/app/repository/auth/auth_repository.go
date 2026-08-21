package auth

import (
    "backend/internal/app/entity"
    "gorm.io/gorm"
)

type UserRepository interface {
    GetByUsername(username string) (*entity.User, error)
    GetByLineUserID(lineUserID string) (*entity.User, error)
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