package pos_test

import (
	"context"
	"errors"
	"testing"

	dtoNotification "backend/internal/app/dto/notification"
	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	salesRepo "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
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
// Mock SaleRepository & POSProductRepository & TestFixture
// -----------------------------------------------------------------------------

type mockSaleRepo struct {
	db                    *gorm.DB
	storeConfig           *entity.StoreConfig
	storeConfigErr        error
	paymentMethods        map[uint]*entity.PaymentMethod
	paymentMethodErr      error
	customerTypes         []entity.CustomerType
	customerTypesErr      error
	searchCustomersResult []entity.Customer
	searchCustomersErr    error
	allPaymentMethods     []entity.PaymentMethod
	allPaymentMethodsErr  error
	createOrderErr        error
	updateOrderErr        error
	deleteItemsErr        error
	existingOrder         *entity.SaleOrder
	existingOrderErr      error
}

var _ salesRepo.SaleRepository = (*mockSaleRepo)(nil)

func (m *mockSaleRepo) BeginTransaction() *gorm.DB {
	return m.db.Begin()
}

func (m *mockSaleRepo) CreateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error {
	if m.createOrderErr != nil {
		return m.createOrderErr
	}
	if order.CustomerID != nil && *order.CustomerID == 0 {
		order.CustomerID = nil
	}
	return tx.Omit("Customer").Create(order).Error
}

func (m *mockSaleRepo) GetStoreConfig() (*entity.StoreConfig, error) {
	if m.storeConfigErr != nil {
		return nil, m.storeConfigErr
	}
	if m.storeConfig != nil {
		return m.storeConfig, nil
	}
	return &entity.StoreConfig{
		MaxCredit:            50000.0,
		MaxOverdueDays:       30,
		MaxExtraDiscountRate: 10.0,
		SupervisedPin:        "1234",
	}, nil
}

func (m *mockSaleRepo) GetPaymentMethodByID(id uint) (*entity.PaymentMethod, error) {
	if m.paymentMethodErr != nil {
		return nil, m.paymentMethodErr
	}
	if method, ok := m.paymentMethods[id]; ok {
		return method, nil
	}
	return nil, errors.New("ไม่พบช่องทางการชำระเงินในระบบ")
}

func (m *mockSaleRepo) GetCustomerTypes() ([]entity.CustomerType, error) {
	if m.customerTypesErr != nil {
		return nil, m.customerTypesErr
	}
	return m.customerTypes, nil
}

func (m *mockSaleRepo) SearchCustomers(searchQuery string) ([]entity.Customer, error) {
	if m.searchCustomersErr != nil {
		return nil, m.searchCustomersErr
	}
	return m.searchCustomersResult, nil
}

func (m *mockSaleRepo) GetPaymentMethods() ([]entity.PaymentMethod, error) {
	if m.allPaymentMethodsErr != nil {
		return nil, m.allPaymentMethodsErr
	}
	return m.allPaymentMethods, nil
}

func (m *mockSaleRepo) GetOrderByID(id uint) (*entity.SaleOrder, error) {
	if m.existingOrderErr != nil {
		return nil, m.existingOrderErr
	}
	return m.existingOrder, nil
}

func (m *mockSaleRepo) UpdateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error {
	if m.updateOrderErr != nil {
		return m.updateOrderErr
	}
	if order.CustomerID != nil && *order.CustomerID == 0 {
		order.CustomerID = nil
	}
	return tx.Omit("Customer", "PaymentMethod").Save(order).Error
}

func (m *mockSaleRepo) DeleteOrderItemsWithTx(tx *gorm.DB, orderID uint) error {
	if m.deleteItemsErr != nil {
		return m.deleteItemsErr
	}
	return tx.Where("order_id = ?", orderID).Delete(&entity.SaleOrderItem{}).Error
}

func (m *mockSaleRepo) GetOrderByOrderNumber(orderNumber string) (*entity.SaleOrder, error) {
	if m.existingOrderErr != nil {
		return nil, m.existingOrderErr
	}
	if m.existingOrder != nil && m.existingOrder.OrderNumber == orderNumber {
		return m.existingOrder, nil
	}
	return nil, errors.New("record not found")
}

type mockPOSProductRepo struct {
	products map[uint]*entity.Product
	getErr   error
}

var _ salesRepo.POSProductRepository = (*mockPOSProductRepo)(nil)

func (m *mockPOSProductRepo) SearchProducts(search string) ([]entity.Product, error) {
	return nil, nil
}

func (m *mockPOSProductRepo) GetProductByID(id uint) (*entity.Product, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	if p, ok := m.products[id]; ok {
		// Return copy
		pCopy := *p
		if pCopy.Unit == nil {
			pCopy.Unit = &entity.Unit{Unit_Name: "ชิ้น"}
		}
		return &pCopy, nil
	}
	return nil, errors.New("record not found")
}

// GetProductByIDWithTx: mock ไม่ได้ผูกกับ transaction จริงเหมือน implementation ตัวจริง — แต่ยังอ่านจาก m.products
// ซึ่งเป็น map เดียวกันที่ UpdateProductWithTx อัปเดต Quantity สดๆ ไว้ให้แล้ว จึงยังเห็นค่าล่าสุดถูกต้องเหมือนอ่านผ่าน tx จริง
func (m *mockPOSProductRepo) GetProductByIDWithTx(tx *gorm.DB, id uint) (*entity.Product, error) {
	return m.GetProductByID(id)
}

func (m *mockPOSProductRepo) UpdateProductWithTx(tx *gorm.DB, product *entity.Product) error {
	if p, ok := m.products[product.ID]; ok {
		p.Quantity = product.Quantity
	}
	return tx.Save(product).Error
}

// testFixture holds the DB, repos, and service for a test
type testFixture struct {
	db          *gorm.DB
	saleRepo    *mockSaleRepo
	productRepo *mockPOSProductRepo
	service     posService.SaleService
}

func newTestFixture(t *testing.T) *testFixture {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.CustomerType{},
		&entity.Customer{},
		&entity.Unit{},
		&entity.Product{},
		&entity.StoreConfig{},
		&entity.PaymentMethod{},
		&entity.SaleOrder{},
		&entity.SaleOrderItem{},
		&entity.Payment{},
		&entity.User{},
		&entity.StockMovement{}, // ตอนนี้ CreatePOSOrder/UpdatePOSOrder เขียนลง stock_movements ด้วย (movement_type = OUT)
	)
	require.NoError(t, err)

	saleRepo := &mockSaleRepo{
		db: db,
		paymentMethods: map[uint]*entity.PaymentMethod{
			1: {Model: gorm.Model{ID: 1}, MethodName: "CASH", IsActive: true, IsCredit: false},
			2: {Model: gorm.Model{ID: 2}, MethodName: "QR_PROMPT_PAY", IsActive: true, IsCredit: false},
			3: {Model: gorm.Model{ID: 3}, MethodName: "CREDIT", IsActive: true, IsCredit: true},
			4: {Model: gorm.Model{ID: 4}, MethodName: "INACTIVE", IsActive: false, IsCredit: false},
		},
	}

	productRepo := &mockPOSProductRepo{
		products: make(map[uint]*entity.Product),
	}

	service := posService.NewSaleService(saleRepo, nil, productRepo)

	return &testFixture{
		db:          db,
		saleRepo:    saleRepo,
		productRepo: productRepo,
		service:     service,
	}
}
