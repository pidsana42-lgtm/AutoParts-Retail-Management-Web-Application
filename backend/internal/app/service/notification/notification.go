package notification

import (
	dtoNotification "backend/internal/app/dto/notification"
	"backend/internal/app/entity"
	repoNotification "backend/internal/app/repository/notification"
	"backend/internal/pkg/websocket"
)

const defaultListLimit = 50

type NotificationService interface {
	// NotifyOwners/NotifyUser บันทึกลง DB ก่อน แล้วค่อยส่ง push แบบเรียลไทม์ผ่าน websocket ตามหลัง
	// ให้ทั้งฝั่งที่ออนไลน์อยู่ (เห็นทันที) และฝั่งที่ไม่ได้เปิดหน้าเว็บอยู่ (เห็นตอนเข้ามาทีหลังจากประวัติใน DB)
	NotifyOwners(notifType, title, message, link string, scheduleID *uint) error
	NotifyUser(userID uint, notifType, title, message, link string, scheduleID *uint) error

	ListForOwners() (*dtoNotification.NotificationListResponseDTO, error)
	ListForUser(userID uint) (*dtoNotification.NotificationListResponseDTO, error)
	MarkRead(id uint) error
	MarkAllReadForOwners() error
	MarkAllReadForUser(userID uint) error
}

type notificationService struct {
	repo repoNotification.NotificationRepository
}

func NewNotificationService(repo repoNotification.NotificationRepository) NotificationService {
	return &notificationService{repo: repo}
}

func (s *notificationService) NotifyOwners(notifType, title, message, link string, scheduleID *uint) error {
	n := entity.Notification{
		Type:                 notifType,
		Title:                title,
		Message:              message,
		Link:                 link,
		ForOwners:            true,
		CheckStockScheduleID: scheduleID,
	}
	if err := s.repo.Create(&n); err != nil {
		return err
	}
	websocket.NotifyOwners(n.ID, title, message, notifType, link)
	return nil
}

func (s *notificationService) NotifyUser(userID uint, notifType, title, message, link string, scheduleID *uint) error {
	n := entity.Notification{
		Type:                 notifType,
		Title:                title,
		Message:              message,
		Link:                 link,
		TargetUserID:         &userID,
		CheckStockScheduleID: scheduleID,
	}
	if err := s.repo.Create(&n); err != nil {
		return err
	}
	websocket.NotifyUser(userID, n.ID, title, message, notifType, link)
	return nil
}

func (s *notificationService) ListForOwners() (*dtoNotification.NotificationListResponseDTO, error) {
	list, err := s.repo.ListForOwners(defaultListLimit)
	if err != nil {
		return nil, err
	}
	count, err := s.repo.UnreadCountForOwners()
	if err != nil {
		return nil, err
	}
	return toListResponse(list, count), nil
}

func (s *notificationService) ListForUser(userID uint) (*dtoNotification.NotificationListResponseDTO, error) {
	list, err := s.repo.ListForUser(userID, defaultListLimit)
	if err != nil {
		return nil, err
	}
	count, err := s.repo.UnreadCountForUser(userID)
	if err != nil {
		return nil, err
	}
	return toListResponse(list, count), nil
}

func (s *notificationService) MarkRead(id uint) error {
	return s.repo.MarkRead(id)
}

func (s *notificationService) MarkAllReadForOwners() error {
	return s.repo.MarkAllReadForOwners()
}

func (s *notificationService) MarkAllReadForUser(userID uint) error {
	return s.repo.MarkAllReadForUser(userID)
}

func toListResponse(list []entity.Notification, unreadCount int64) *dtoNotification.NotificationListResponseDTO {
	items := make([]dtoNotification.NotificationResponseDTO, len(list))
	for i, n := range list {
		items[i] = dtoNotification.NotificationResponseDTO{
			ID:                   n.ID,
			Type:                 n.Type,
			Title:                n.Title,
			Message:              n.Message,
			Link:                 n.Link,
			IsRead:               n.IsRead,
			CheckStockScheduleID: n.CheckStockScheduleID,
			CreatedAt:            n.CreatedAt,
		}
	}
	return &dtoNotification.NotificationListResponseDTO{
		Notifications: items,
		UnreadCount:   unreadCount,
	}
}
