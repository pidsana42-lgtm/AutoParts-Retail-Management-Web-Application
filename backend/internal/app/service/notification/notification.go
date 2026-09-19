package notification

import (
	dtoNotification "backend/internal/app/dto/notification"
	"backend/internal/app/entity"
	repoNotification "backend/internal/app/repository/notification"
	"backend/internal/app/service/email"
	"backend/internal/pkg/websocket"
	"fmt"
	"os"
)

const defaultListLimit = 50

type NotificationService interface {
	// NotifyOwners/NotifyUser/NotifyEmployees บันทึกลง DB ก่อน แล้วค่อยส่ง push แบบเรียลไทม์ผ่าน websocket ตามหลัง
	// ให้ทั้งฝั่งที่ออนไลน์อยู่ (เห็นทันที) และฝั่งที่ไม่ได้เปิดหน้าเว็บอยู่ (เห็นตอนเข้ามาทีหลังจากประวัติใน DB)
	NotifyOwners(notifType, title, message, link string, scheduleID *uint) error
	NotifyUser(userID uint, notifType, title, message, link string, scheduleID *uint) error
	// NotifyEmployees: แจ้งเตือนพนักงานทุกคน (ไม่เจาะจงคนเดียว) เช่น มีการเช็คสต็อกโซน/หมวดหมู่นี้อยู่ ให้คนอื่นรู้ไว้เผื่อไปยุ่งกับสต็อกจุดเดียวกัน
	NotifyEmployees(notifType, title, message, link string, scheduleID *uint) error

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

	// ส่งแจ้งเตือนทางอีเมลถึงเจ้าของร้านอัตโนมัติ (Async)
	go func() {
		toEmail := os.Getenv("SMTP_USER")
		if toEmail == "" {
			return
		}
		emailSvc := email.NewEmailService()
		subject := fmt.Sprintf("🔔 [JJ AutoParts] %s", title)
		htmlBody := fmt.Sprintf(`
		<!DOCTYPE html>
		<html>
		<head><meta charset="utf-8"></head>
		<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f5f7;">
			<table width="100%%" border="0" cellspacing="0" cellpadding="0" style="padding: 30px 0;">
				<tr>
					<td align="center">
						<table width="520" border="0" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.08);">
							<tr>
								<td style="background-color: #1c1b1b; padding: 20px 25px; text-align: center;">
									<h2 style="color: #ffffff; margin: 0; font-size: 18px;">JJ AUTO PARTS</h2>
									<p style="color: #e51c23; margin: 3px 0 0; font-size: 12px; font-weight: bold;">ระบบแจ้งเตือนร้านค้าอัตโนมัติ</p>
								</td>
							</tr>
							<tr>
								<td style="padding: 25px;">
									<h3 style="color: #222222; margin: 0 0 10px; font-size: 16px;">%s</h3>
									<p style="color: #555555; line-height: 1.6; margin: 0 0 20px; font-size: 14px;">%s</p>
									<div style="background-color: #f8fafc; border-left: 4px solid #e51c23; padding: 12px 15px; border-radius: 4px;">
										<span style="font-size: 12px; color: #64748b;">ประเภทการแจ้งเตือน: <strong>%s</strong></span>
									</div>
								</td>
							</tr>
							<tr>
								<td style="background-color: #f9fafb; padding: 14px 25px; text-align: center; border-top: 1px solid #eeeeee;">
									<p style="color: #999999; font-size: 12px; margin: 0;">JJ AutoParts Pakchong</p>
								</td>
							</tr>
						</table>
					</td>
				</tr>
			</table>
		</body>
		</html>
		`, title, message, notifType)
		_ = emailSvc.SendEmail([]string{toEmail}, subject, htmlBody)
	}()

	return nil
}

func (s *notificationService) NotifyEmployees(notifType, title, message, link string, scheduleID *uint) error {
	n := entity.Notification{
		Type:                 notifType,
		Title:                title,
		Message:              message,
		Link:                 link,
		ForEmployees:         true,
		CheckStockScheduleID: scheduleID,
	}
	if err := s.repo.Create(&n); err != nil {
		return err
	}
	websocket.NotifyEmployees(n.ID, title, message, notifType, link)
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
