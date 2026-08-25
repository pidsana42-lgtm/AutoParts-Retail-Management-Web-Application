package notification

import (
	"backend/internal/app/entity"

	"gorm.io/gorm"
)

type NotificationRepository interface {
	Create(n *entity.Notification) error
	ListForOwners(limit int) ([]entity.Notification, error)
	// ListForUser: ของพนักงานคนนั้นโดยตรง (target_user_id) รวมกับของกลุ่มพนักงานทั้งหมด (for_employees) ให้เห็นทั้งคู่
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
	err := r.db.Where("target_user_id = ? OR for_employees = ?", userID, true).Order("created_at desc").Limit(limit).Find(&list).Error
	return list, err
}

func (r *notificationRepository) UnreadCountForOwners() (int64, error) {
	var count int64
	err := r.db.Model(&entity.Notification{}).Where("for_owners = ? AND is_read = ?", true, false).Count(&count).Error
	return count, err
}

func (r *notificationRepository) UnreadCountForUser(userID uint) (int64, error) {
	var count int64
	err := r.db.Model(&entity.Notification{}).
		Where("(target_user_id = ? OR for_employees = ?) AND is_read = ?", userID, true, false).
		Count(&count).Error
	return count, err
}

func (r *notificationRepository) MarkRead(id uint) error {
	return r.db.Model(&entity.Notification{}).Where("id = ?", id).Update("is_read", true).Error
}

func (r *notificationRepository) MarkAllReadForOwners() error {
	return r.db.Model(&entity.Notification{}).Where("for_owners = ? AND is_read = ?", true, false).Update("is_read", true).Error
}

func (r *notificationRepository) MarkAllReadForUser(userID uint) error {
	// หมายเหตุ: for_employees เป็นแจ้งเตือนกลุ่ม (ทุกพนักงานเห็นแถวเดียวกัน) พอพนักงานคนใดคนหนึ่งกด "อ่านทั้งหมด"
	// แถวกลุ่มนี้จะถูก mark read ไปเลย (คนอื่นก็จะเห็นเป็นอ่านแล้วด้วย) เหมือนพฤติกรรมเดิมของ ForOwners
	return r.db.Model(&entity.Notification{}).
		Where("(target_user_id = ? OR for_employees = ?) AND is_read = ?", userID, true, false).
		Update("is_read", true).Error
}
