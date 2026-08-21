package notification

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type NotificationRepository interface {
	Create(n *entity.Notification) error
	ListForOwners(limit int) ([]entity.Notification, error)
	ListForUser(userID uint, limit int) ([]entity.Notification, error)
	UnreadCountForOwners() (int64, error)
	UnreadCountForUser(userID uint) (int64, error)
	MarkRead(id uint) error
	MarkAllReadForOwners() error
	MarkAllReadForUser(userID uint) error
}

type notificationRepository struct {
	db *gorm.DB
}

func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(n *entity.Notification) error {
	return r.db.Create(n).Error
}

func (r *notificationRepository) ListForOwners(limit int) ([]entity.Notification, error) {
	var list []entity.Notification
	err := r.db.Where("for_owners = ?", true).Order("created_at desc").Limit(limit).Find(&list).Error
	return list, err
}

func (r *notificationRepository) ListForUser(userID uint, limit int) ([]entity.Notification, error) {
	var list []entity.Notification
	err := r.db.Where("target_user_id = ?", userID).Order("created_at desc").Limit(limit).Find(&list).Error
	return list, err
}

func (r *notificationRepository) UnreadCountForOwners() (int64, error) {
	var count int64
	err := r.db.Model(&entity.Notification{}).Where("for_owners = ? AND is_read = ?", true, false).Count(&count).Error
	return count, err
}

func (r *notificationRepository) UnreadCountForUser(userID uint) (int64, error) {
	var count int64
	err := r.db.Model(&entity.Notification{}).Where("target_user_id = ? AND is_read = ?", userID, false).Count(&count).Error
	return count, err
}

func (r *notificationRepository) MarkRead(id uint) error {
	return r.db.Model(&entity.Notification{}).Where("id = ?", id).Update("is_read", true).Error
}

func (r *notificationRepository) MarkAllReadForOwners() error {
	return r.db.Model(&entity.Notification{}).Where("for_owners = ? AND is_read = ?", true, false).Update("is_read", true).Error
}

func (r *notificationRepository) MarkAllReadForUser(userID uint) error {
	return r.db.Model(&entity.Notification{}).Where("target_user_id = ? AND is_read = ?", userID, false).Update("is_read", true).Error
}
