package pos_test

import (
	"context"

	dtoNotification "backend/internal/app/dto/notification"
	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	salesRepo "backend/internal/app/repository/pos"

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
