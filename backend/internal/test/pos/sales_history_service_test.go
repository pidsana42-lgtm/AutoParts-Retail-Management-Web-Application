package pos_test

import (
	"context"
	"errors"
	"testing"
	"time"

	dtoNotification "backend/internal/app/dto/notification"
	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	salesRepo "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// -----------------------------------------------------------------------------
// Mock SalesHistoryRepository
// -----------------------------------------------------------------------------

type mockSalesHistoryRepo struct {
	getSalesHistoryFn           func(req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
	getSaleHistoryByIDFn        func(identifier string) (*entity.SaleOrder, error)
	requestCancelOrderFn        func(orderID uint, userID uint, reason string) error
	approveCancelOrderFn        func(order *entity.SaleOrder, remark string) error
	rejectCancelOrderFn         func(orderID uint, remark string) error
	revertCancelOrderFn         func(orderID uint, note string) error
	getCancellationRequestsFn   func(req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
	getMyCancellationRequestsFn func(userID uint, req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error)
	getEmployeesFn              func() ([]entity.User, error)
	getUserByIDFn               func(userID uint) (*entity.User, error)
	getCompanySettingFn         func(ctx context.Context) (*entity.CompanySetting, error)

	calls map[string]int
}

func newMockSalesHistoryRepo() *mockSalesHistoryRepo {
	return &mockSalesHistoryRepo{calls: make(map[string]int)}
}

func (m *mockSalesHistoryRepo) track(name string) {
	m.calls[name]++
}

func (m *mockSalesHistoryRepo) GetSalesHistory(req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
	m.track("GetSalesHistory")
	if m.getSalesHistoryFn != nil {
		return m.getSalesHistoryFn(req)
	}
	return nil, 0, nil
}

func (m *mockSalesHistoryRepo) GetSaleHistoryByID(identifier string) (*entity.SaleOrder, error) {
	m.track("GetSaleHistoryByID")
	if m.getSaleHistoryByIDFn != nil {
		return m.getSaleHistoryByIDFn(identifier)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockSalesHistoryRepo) RequestCancelOrder(orderID uint, userID uint, reason string) error {
	m.track("RequestCancelOrder")
	if m.requestCancelOrderFn != nil {
		return m.requestCancelOrderFn(orderID, userID, reason)
	}
	return nil
}

func (m *mockSalesHistoryRepo) ApproveCancelOrder(order *entity.SaleOrder, remark string) error {
	m.track("ApproveCancelOrder")
	if m.approveCancelOrderFn != nil {
		return m.approveCancelOrderFn(order, remark)
	}
	return nil
}

func (m *mockSalesHistoryRepo) RejectCancelOrder(orderID uint, remark string) error {
	m.track("RejectCancelOrder")
	if m.rejectCancelOrderFn != nil {
		return m.rejectCancelOrderFn(orderID, remark)
	}
	return nil
}

func (m *mockSalesHistoryRepo) RevertCancelOrder(orderID uint, note string) error {
	m.track("RevertCancelOrder")
	if m.revertCancelOrderFn != nil {
		return m.revertCancelOrderFn(orderID, note)
	}
	return nil
}

func (m *mockSalesHistoryRepo) GetCancellationRequests(req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
	m.track("GetCancellationRequests")
	if m.getCancellationRequestsFn != nil {
		return m.getCancellationRequestsFn(req)
	}
	return nil, 0, nil
}

func (m *mockSalesHistoryRepo) GetMyCancellationRequests(userID uint, req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
	m.track("GetMyCancellationRequests")
	if m.getMyCancellationRequestsFn != nil {
		return m.getMyCancellationRequestsFn(userID, req)
	}
	return nil, 0, nil
}

func (m *mockSalesHistoryRepo) GetEmployees() ([]entity.User, error) {
	m.track("GetEmployees")
	if m.getEmployeesFn != nil {
		return m.getEmployeesFn()
	}
	return nil, nil
}

func (m *mockSalesHistoryRepo) GetUserByID(userID uint) (*entity.User, error) {
	m.track("GetUserByID")
	if m.getUserByIDFn != nil {
		return m.getUserByIDFn(userID)
	}
	return nil, nil
}

func (m *mockSalesHistoryRepo) GetCompanySetting(ctx context.Context) (*entity.CompanySetting, error) {
	m.track("GetCompanySetting")
	if m.getCompanySettingFn != nil {
		return m.getCompanySettingFn(ctx)
	}
	return &entity.CompanySetting{CompanyName: "Test Store"}, nil
}

var _ salesRepo.SalesHistoryRepository = (*mockSalesHistoryRepo)(nil)

// -----------------------------------------------------------------------------
// Mock NotificationService
// -----------------------------------------------------------------------------

type notifRecord struct {
	target  string
	userID  uint
	typ     string
	title   string
	message string
}

type fakeNotificationService struct {
	records []notifRecord
	failErr error
}

func (f *fakeNotificationService) NotifyOwners(notifType, title, message, link string, scheduleID *uint) error {
	if f.failErr != nil {
		return f.failErr
	}
	f.records = append(f.records, notifRecord{
		target:  "owners",
		typ:     notifType,
		title:   title,
		message: message,
	})
	return nil
}

func (f *fakeNotificationService) NotifyUser(userID uint, notifType, title, message, link string, scheduleID *uint) error {
	if f.failErr != nil {
		return f.failErr
	}
	f.records = append(f.records, notifRecord{
		target:  "user",
		userID:  userID,
		typ:     notifType,
		title:   title,
		message: message,
	})
	return nil
}

func (f *fakeNotificationService) NotifyEmployees(notifType, title, message, link string, scheduleID *uint) error {
	return nil
}

func (f *fakeNotificationService) ListForOwners() (*dtoNotification.NotificationListResponseDTO, error) {
	return nil, nil
}

func (f *fakeNotificationService) ListForUser(userID uint) (*dtoNotification.NotificationListResponseDTO, error) {
	return nil, nil
}

func (f *fakeNotificationService) MarkRead(id uint) error {
	return nil
}

func (f *fakeNotificationService) MarkAllReadForOwners() error {
	return nil
}

func (f *fakeNotificationService) MarkAllReadForUser(userID uint) error {
	return nil
}

// -----------------------------------------------------------------------------
// Unit Tests: SalesHistoryService
// -----------------------------------------------------------------------------

func TestGetSalesHistory_Success(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	fakeNotif := &fakeNotificationService{}
	service := posService.NewSalesHistoryService(repo, fakeNotif)

	dummyOrders := []entity.SaleOrder{
		{
			Model: gorm.Model{
				ID:        1,
				CreatedAt: time.Now(),
			},
			OrderNumber:   "INV-2026-001",
			TotalAmount:   1500.0,
			BalanceDue:    0.0,
			PaymentStatus: "paid",
			Status:        enum.OrderCompleted,
		},
		{
			Model: gorm.Model{
				ID:        2,
				CreatedAt: time.Now(),
			},
			OrderNumber:   "INV-2026-002",
			TotalAmount:   2500.0,
			BalanceDue:    2500.0,
			PaymentStatus: "unpaid",
			Status:        enum.OrderCompleted,
		},
	}

	repo.getSalesHistoryFn = func(req posDto.SalesHistoryFilterRequest) ([]entity.SaleOrder, int64, error) {
		return dummyOrders, int64(len(dummyOrders)), nil
	}

	req := posDto.SalesHistoryFilterRequest{
		Page:  1,
		Limit: 10,
	}

	res, err := service.GetSalesHistory(req)

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, 2, len(res.Items))
	assert.Equal(t, int64(2), res.TotalRows)
	assert.Equal(t, 1, res.TotalPages)
	assert.Equal(t, "INV-2026-001", res.Items[0].OrderNumber)
	assert.Equal(t, 1, repo.calls["GetSalesHistory"])
}

func TestGetSaleHistoryByID_Success(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		assert.Equal(t, "10", identifier)
		return &entity.SaleOrder{
			Model: gorm.Model{
				ID: 10,
			},
			OrderNumber: "INV-2026-010",
			TotalAmount: 3000.0,
			Status:      enum.OrderCompleted,
		}, nil
	}

	ctx := context.Background()
	res, err := service.GetSaleHistoryByID(ctx, "10")

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, uint(10), res.ID)
	assert.Equal(t, "INV-2026-010", res.OrderNumber)
	assert.Equal(t, 3000.0, res.TotalAmount)
}

func TestGetSaleHistoryByID_NotFound(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return nil, gorm.ErrRecordNotFound
	}

	ctx := context.Background()
	res, err := service.GetSaleHistoryByID(ctx, "999")

	require.Error(t, err)
	assert.Nil(t, res)
	assert.True(t, errors.Is(err, gorm.ErrRecordNotFound))
}

func TestRequestCancelSale_Success(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	fakeNotif := &fakeNotificationService{}
	service := posService.NewSalesHistoryService(repo, fakeNotif)

	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 5,
		},
		OrderNumber: "INV-2026-005",
		Status:      enum.OrderCompleted,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	repo.requestCancelOrderFn = func(orderID uint, userID uint, reason string) error {
		assert.Equal(t, uint(5), orderID)
		assert.Equal(t, uint(101), userID)
		assert.Equal(t, "ลูกค้าขอยกเลิกสินค้า", reason)
		return nil
	}

	ctx := context.Background()
	req := posDto.RequestCancelOrderRequest{Reason: "ลูกค้าขอยกเลิกสินค้า"}

	err := service.RequestCancelSale(ctx, "5", 101, req)

	require.NoError(t, err)
	assert.Equal(t, 1, repo.calls["RequestCancelOrder"])

	// ตรวจสอบว่าส่ง Notification ถึง Owners
	require.Len(t, fakeNotif.records, 1)
	assert.Equal(t, "owners", fakeNotif.records[0].target)
	assert.Equal(t, "warning", fakeNotif.records[0].typ)
	assert.Contains(t, fakeNotif.records[0].message, "INV-2026-005")
}

func TestRequestCancelSale_AlreadyCancelled(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 5,
		},
		OrderNumber: "INV-2026-005",
		Status:      enum.OrderCancelled,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	ctx := context.Background()
	req := posDto.RequestCancelOrderRequest{Reason: "ยกเลิกซ้ำ"}

	err := service.RequestCancelSale(ctx, "5", 101, req)

	require.Error(t, err)
	assert.Equal(t, "รายการนี้ถูกยกเลิกไปแล้ว", err.Error())
	assert.Equal(t, 0, repo.calls["RequestCancelOrder"])
}

func TestRequestCancelSale_AlreadyPendingCancel(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 5,
		},
		OrderNumber: "INV-2026-005",
		Status:      enum.OrderPendingCancel,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	ctx := context.Background()
	req := posDto.RequestCancelOrderRequest{Reason: "ยกเลิกซ้ำ"}

	err := service.RequestCancelSale(ctx, "5", 101, req)

	require.Error(t, err)
	assert.Equal(t, "รายการนี้อยู่ระหว่างรออนุมัติการยกเลิกอยู่แล้ว", err.Error())
	assert.Equal(t, 0, repo.calls["RequestCancelOrder"])
}

func TestApproveCancelSale_Success(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	fakeNotif := &fakeNotificationService{}
	service := posService.NewSalesHistoryService(repo, fakeNotif)

	requesterID := uint(101)
	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 8,
		},
		OrderNumber:          "INV-2026-008",
		Status:               enum.OrderPendingCancel,
		CancelRequestedByID: &requesterID,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	repo.approveCancelOrderFn = func(o *entity.SaleOrder, remark string) error {
		assert.Equal(t, uint(8), o.ID)
		assert.Equal(t, "อนุมัติตามคำขอ", remark)
		return nil
	}

	ctx := context.Background()
	req := posDto.ProcessCancelOrderRequest{Remark: "อนุมัติตามคำขอ"}

	err := service.ApproveCancelSale(ctx, "8", 1, req) // Owner ID = 1

	require.NoError(t, err)
	assert.Equal(t, 1, repo.calls["ApproveCancelOrder"])

	// ตรวจสอบว่าส่ง Notification แจ้งกลับไปยังผู้ขอยกเลิก (User ID 101)
	require.Len(t, fakeNotif.records, 1)
	assert.Equal(t, "user", fakeNotif.records[0].target)
	assert.Equal(t, requesterID, fakeNotif.records[0].userID)
	assert.Equal(t, "success", fakeNotif.records[0].typ)
	assert.Contains(t, fakeNotif.records[0].message, "ได้รับการอนุมัติแล้ว")
}

func TestApproveCancelSale_InvalidStatus(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 8,
		},
		OrderNumber: "INV-2026-008",
		Status:      enum.OrderCancelled, // ไม่ใช่ PendingCancel หรือ Completed
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	ctx := context.Background()
	req := posDto.ProcessCancelOrderRequest{Remark: "ลองอนุมัติ"}

	err := service.ApproveCancelSale(ctx, "8", 1, req)

	require.Error(t, err)
	assert.Equal(t, "รายการนี้ไม่อยู่ในสถานะที่สามารถอนุมัติหรือยกเลิกได้", err.Error())
	assert.Equal(t, 0, repo.calls["ApproveCancelOrder"])
}

func TestRejectCancelSale_Success(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	fakeNotif := &fakeNotificationService{}
	service := posService.NewSalesHistoryService(repo, fakeNotif)

	requesterID := uint(101)
	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 9,
		},
		OrderNumber:          "INV-2026-009",
		Status:               enum.OrderPendingCancel,
		CancelRequestedByID: &requesterID,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	repo.rejectCancelOrderFn = func(orderID uint, remark string) error {
		assert.Equal(t, uint(9), orderID)
		assert.Equal(t, "ข้อมูลไม่เพียงพอ ไม่อนุมัติ", remark)
		return nil
	}

	ctx := context.Background()
	req := posDto.ProcessCancelOrderRequest{Remark: "ข้อมูลไม่เพียงพอ ไม่อนุมัติ"}

	err := service.RejectCancelSale(ctx, "9", req)

	require.NoError(t, err)
	assert.Equal(t, 1, repo.calls["RejectCancelOrder"])

	// ตรวจสอบว่าส่ง Notification แจ้งปฏิเสธกลับไปยังผู้ขอ (User ID 101)
	require.Len(t, fakeNotif.records, 1)
	assert.Equal(t, "user", fakeNotif.records[0].target)
	assert.Equal(t, requesterID, fakeNotif.records[0].userID)
	assert.Equal(t, "error", fakeNotif.records[0].typ)
	assert.Contains(t, fakeNotif.records[0].message, "ถูกปฏิเสธ")
}

func TestRevertCancellationRequest_Success(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	requesterID := uint(101)
	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 12,
		},
		OrderNumber:          "INV-2026-012",
		Status:               enum.OrderPendingCancel,
		CancelRequestedByID: &requesterID,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	repo.revertCancelOrderFn = func(orderID uint, note string) error {
		assert.Equal(t, uint(12), orderID)
		return nil
	}

	ctx := context.Background()
	res, err := service.RevertCancellationRequest(ctx, "12", requesterID) // Requester ID matches

	require.NoError(t, err)
	require.NotNil(t, res)
	assert.Equal(t, uint(12), res.OrderID)
	assert.Equal(t, string(enum.OrderCompleted), res.Status)
	assert.Equal(t, 1, repo.calls["RevertCancelOrder"])
}

func TestRevertCancellationRequest_UnauthorizedUser(t *testing.T) {
	repo := newMockSalesHistoryRepo()
	service := posService.NewSalesHistoryService(repo, nil)

	requesterID := uint(101)
	order := &entity.SaleOrder{
		Model: gorm.Model{
			ID: 12,
		},
		OrderNumber:          "INV-2026-012",
		Status:               enum.OrderPendingCancel,
		CancelRequestedByID: &requesterID,
	}

	repo.getSaleHistoryByIDFn = func(identifier string) (*entity.SaleOrder, error) {
		return order, nil
	}

	ctx := context.Background()
	differentUserID := uint(999) // คนละคนกับผู้ขอ
	res, err := service.RevertCancellationRequest(ctx, "12", differentUserID)

	require.Error(t, err)
	assert.Nil(t, res)
	assert.Equal(t, "ไม่มีสิทธิ์ดึงคำขอยกเลิกนี้กลับ เนื่องจากคุณไม่ได้เป็นผู้ส่งคำขอ", err.Error())
	assert.Equal(t, 0, repo.calls["RevertCancelOrder"])
}
