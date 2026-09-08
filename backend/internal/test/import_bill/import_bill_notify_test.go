package importbill

import (
	"testing"
	"time"

	importDataDTO "backend/internal/app/dto/import_data"
	dtoNotification "backend/internal/app/dto/notification"
	billRepo "backend/internal/app/repository/import_data"
	billService "backend/internal/app/service/import_data"

	"github.com/stretchr/testify/require"
)

// -----------------------------------------------------------------------------
// Spy NotificationService: จับว่า NotifyOwners ถูกเรียกหรือไม่ ตอนบิลรออนุมัติ
// -----------------------------------------------------------------------------

type spyNotificationService struct {
	notifyOwnersCalls []string // เก็บ notifType ของทุกครั้งที่ถูกเรียก
}

func (s *spyNotificationService) NotifyOwners(notifType, title, message, link string, scheduleID *uint) error {
	s.notifyOwnersCalls = append(s.notifyOwnersCalls, notifType)
	return nil
}
func (s *spyNotificationService) NotifyUser(userID uint, notifType, title, message, link string, scheduleID *uint) error {
	return nil
}
func (s *spyNotificationService) NotifyEmployees(notifType, title, message, link string, scheduleID *uint) error {
	return nil
}
func (s *spyNotificationService) ListForOwners() (*dtoNotification.NotificationListResponseDTO, error) {
	return &dtoNotification.NotificationListResponseDTO{}, nil
}
func (s *spyNotificationService) ListForUser(userID uint) (*dtoNotification.NotificationListResponseDTO, error) {
	return &dtoNotification.NotificationListResponseDTO{}, nil
}
func (s *spyNotificationService) MarkRead(id uint) error        { return nil }
func (s *spyNotificationService) MarkAllReadForOwners() error   { return nil }
func (s *spyNotificationService) MarkAllReadForUser(uint) error { return nil }

func newConfirmBillImportInput(billNo string, supplierID, productID uint, pricePerUnit float64) importDataDTO.ConfirmBillImportDTO {
	now := importDataDTO.FlexTime{Time: time.Now()}
	return importDataDTO.ConfirmBillImportDTO{
		Bill: importDataDTO.CreateBillDTO{
			BillNo:      billNo,
			TotalAmount: 300,
			DueDate:     now,
			ReceiveDate: now,
			SupplierID:  supplierID,
			Subtotal:    300,
			GrandTotal:  300,
			VerifiedBy:  1,
		},
		Items: []importDataDTO.CreateBillItemDTO{
			{
				ItemSequence:       1,
				CompanyProductCode: "CODE-1",
				CompanyProductName: "สินค้าทดสอบ",
				OrderQuantity:      2,
				Unit:               "ชิ้น",
				ConversionFactor:   1,
				PricePerUnit:       pricePerUnit,
				NetAmount:          pricePerUnit * 2,
				ProductID:          productID,
			},
		},
	}
}

func TestConfirmBillImport_NotifiesOwnersWhenPendingApproval(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	spy := &spyNotificationService{}
	svc := billService.NewImportBillService(repo, spy)

	input := newConfirmBillImportInput("BILL-NOTIFY-EMP", supplier.ID, product.ID, 150) // ราคาไม่ตรง
	_, err := svc.ConfirmBillImport(0, input, "Employee")
	require.NoError(t, err)

	require.Len(t, spy.notifyOwnersCalls, 1, "พนักงานนำเข้าบิลที่ต้องรออนุมัติ ต้องแจ้งเตือนเจ้าของร้าน 1 ครั้ง")
	require.Equal(t, "IMPORT_BILL_PENDING_APPROVAL", spy.notifyOwnersCalls[0])
}

func TestConfirmBillImport_DoesNotNotifyWhenAutoApproved(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	spy := &spyNotificationService{}
	svc := billService.NewImportBillService(repo, spy)

	// เจ้าของร้านนำเข้าเอง -> auto-approve ไม่ต้องแจ้งเตือน
	input := newConfirmBillImportInput("BILL-NOTIFY-OWNER", supplier.ID, product.ID, 150)
	_, err := svc.ConfirmBillImport(0, input, "Owner")
	require.NoError(t, err)

	require.Empty(t, spy.notifyOwnersCalls, "เจ้าของร้านนำเข้าเองไม่ต้องแจ้งเตือนตัวเอง")
}

func TestConfirmBillImport_DoesNotNotifyWhenNoPriceMismatch(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	spy := &spyNotificationService{}
	svc := billService.NewImportBillService(repo, spy)

	// พนักงานนำเข้าแต่ราคาตรงกับระบบ -> auto-approve ไม่ต้องแจ้งเตือน
	input := newConfirmBillImportInput("BILL-NOTIFY-EMP-MATCH", supplier.ID, product.ID, 100)
	_, err := svc.ConfirmBillImport(0, input, "Employee")
	require.NoError(t, err)

	require.Empty(t, spy.notifyOwnersCalls, "ไม่มีราคาที่ต่างจากระบบ ไม่ต้องรออนุมัติ จึงไม่ต้องแจ้งเตือน")
}
