package purchaseorders

import (
	poEntity "backend/internal/app/entity"
	"context"
	"gorm.io/gorm"
)

// UserRepository คุมตาราง users
type UserRepository interface {
	FindByID(ctx context.Context, id uint) (*poEntity.User, error)
}

type userRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

// FindByID ดึงข้อมูลใบสั่งซื้อ 1 ใบ พร้อม Preload รายการสินค้า (POItems) ติดมาด้วย
func (r *userRepository) FindByID(ctx context.Context, id uint) (*poEntity.User, error) {
	var user poEntity.User

	err := r.db.WithContext(ctx).First(&user, id).Error

	if err != nil {
		return nil, err
	}

	return &user, nil
}
