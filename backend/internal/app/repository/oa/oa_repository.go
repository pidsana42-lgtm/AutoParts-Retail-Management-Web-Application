package oa

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type Repository interface {
	GetLineUsers() ([]entity.LineUser, error)
	GetLineUserByID(lineUserID string) (*entity.LineUser, error)
	SaveLineUser(user *entity.LineUser) error
	GetLineMessages(lineUserID string) ([]entity.LineMessage, error)
	SaveLineMessage(msg *entity.LineMessage) error
	MarkMessagesAsRead(lineUserID string) error
	LinkCustomer(lineUserID string, customerID uint) error
	GetUnreadCount(lineUserID string) (int, error)
	GetCustomerByPhone(phone string) (*entity.Customer, error)
	GetSystemUserByLineID(lineUserID string) (*entity.User, error)
}

type repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) Repository {
	return &repository{db: db}
}

func (r *repository) GetLineUsers() ([]entity.LineUser, error) {
	var users []entity.LineUser
	err := r.db.Preload("Customer").Order("updated_at desc").Find(&users).Error
	return users, err
}

func (r *repository) GetLineUserByID(lineUserID string) (*entity.LineUser, error) {
	var user entity.LineUser
	err := r.db.Preload("Customer").Where("line_user_id = ?", lineUserID).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}

func (r *repository) SaveLineUser(user *entity.LineUser) error {
	var existing entity.LineUser
	err := r.db.Where("line_user_id = ?", user.LineUserID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		return r.db.Create(user).Error
	} else if err != nil {
		return err
	}
	
	// Update details
	existing.DisplayName = user.DisplayName
	existing.PictureURL = user.PictureURL
	existing.StatusMessage = user.StatusMessage
	existing.Language = user.Language
	return r.db.Save(&existing).Error
}

func (r *repository) GetLineMessages(lineUserID string) ([]entity.LineMessage, error) {
	var messages []entity.LineMessage
	err := r.db.Where("line_user_id = ?", lineUserID).Order("created_at asc").Find(&messages).Error
	return messages, err
}

func (r *repository) SaveLineMessage(msg *entity.LineMessage) error {
	return r.db.Create(msg).Error
}

func (r *repository) MarkMessagesAsRead(lineUserID string) error {
	return r.db.Model(&entity.LineMessage{}).
		Where("line_user_id = ? AND sender = ? AND is_read = ?", lineUserID, "user", false).
		Update("is_read", true).Error
}

func (r *repository) LinkCustomer(lineUserID string, customerID uint) error {
	return r.db.Model(&entity.LineUser{}).
		Where("line_user_id = ?", lineUserID).
		Update("customer_id", customerID).Error
}

func (r *repository) GetUnreadCount(lineUserID string) (int, error) {
	var count int64
	err := r.db.Model(&entity.LineMessage{}).
		Where("line_user_id = ? AND sender = ? AND is_read = ?", lineUserID, "user", false).
		Count(&count).Error
	return int(count), err
}

func (r *repository) GetCustomerByPhone(phone string) (*entity.Customer, error) {
	var customer entity.Customer
	err := r.db.Where("phone_number = ?", phone).First(&customer).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &customer, nil
}

func (r *repository) GetSystemUserByLineID(lineUserID string) (*entity.User, error) {
	var user entity.User
	err := r.db.Preload("Role").Where("line_user_id = ?", lineUserID).First(&user).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return nil, nil
		}
		return nil, err
	}
	return &user, nil
}
