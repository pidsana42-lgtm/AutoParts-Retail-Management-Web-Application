package pos_test

import (
	"errors"
	"testing"

	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	posRepo "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// -----------------------------------------------------------------------------
// Mock CustomerDiscountRepository
// -----------------------------------------------------------------------------

type mockCustomerDiscountRepo struct {
	searchCustomersFn       func(searchQuery string) ([]entity.Customer, error)
	getCreditCustomerByIDFn func(id uint) (*entity.Customer, error)
	getCreditCustomersFn    func() ([]entity.Customer, error)
	updateCustomerFn        func(customer *entity.Customer) error
	getCustomersDebtAgingFn func() (map[uint]posRepo.CustomerDebtAging, error)

	calls map[string]int
}

func newMockCustomerDiscountRepo() *mockCustomerDiscountRepo {
	return &mockCustomerDiscountRepo{calls: make(map[string]int)}
}

func (m *mockCustomerDiscountRepo) track(name string) {
	m.calls[name]++
}

func (m *mockCustomerDiscountRepo) SearchCustomers(searchQuery string) ([]entity.Customer, error) {
	m.track("SearchCustomers")
	if m.searchCustomersFn != nil {
		return m.searchCustomersFn(searchQuery)
	}
	return nil, nil
}

func (m *mockCustomerDiscountRepo) GetCreditCustomerByID(id uint) (*entity.Customer, error) {
	m.track("GetCreditCustomerByID")
	if m.getCreditCustomerByIDFn != nil {
		return m.getCreditCustomerByIDFn(id)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockCustomerDiscountRepo) GetCreditCustomers() ([]entity.Customer, error) {
	m.track("GetCreditCustomers")
	if m.getCreditCustomersFn != nil {
		return m.getCreditCustomersFn()
	}
	return nil, nil
}

func (m *mockCustomerDiscountRepo) UpdateCustomer(customer *entity.Customer) error {
	m.track("UpdateCustomer")
	if m.updateCustomerFn != nil {
		return m.updateCustomerFn(customer)
	}
	return nil
}

func (m *mockCustomerDiscountRepo) GetCustomersDebtAging() (map[uint]posRepo.CustomerDebtAging, error) {
	m.track("GetCustomersDebtAging")
	if m.getCustomersDebtAgingFn != nil {
		return m.getCustomersDebtAgingFn()
	}
	return make(map[uint]posRepo.CustomerDebtAging), nil
}

var _ posRepo.CustomerDiscountRepository = (*mockCustomerDiscountRepo)(nil)

// -----------------------------------------------------------------------------
// Unit Tests: CustomerDiscountService
// -----------------------------------------------------------------------------

func TestGetCustomerDiscount_Success(t *testing.T) {
	repo := newMockCustomerDiscountRepo()
	service := posService.NewCustomerDiscountService(repo)

	dummyCustomers := []entity.Customer{
		{
			Model:                gorm.Model{ID: 1},
			CustomerName:         "อู่ช่างสมชาย",
			PhoneNumber:          "0812345678",
			StandardDiscountRate: 5.0,
			IsDiscountEnabled:    true,
		},
		{
			Model:                gorm.Model{ID: 2},
			CustomerName:         "อู่สปีดออโต้",
			PhoneNumber:          "0898765432",
			StandardDiscountRate: 10.0,
			IsDiscountEnabled:    false,
		},
	}

	repo.searchCustomersFn = func(query string) ([]entity.Customer, error) {
		assert.Equal(t, "สมชาย", query)
		return dummyCustomers, nil
	}

	res, err := service.GetCustomerDiscount("สมชาย")

	require.NoError(t, err)
	require.Len(t, res, 2)
	assert.Equal(t, uint(1), res[0].ID)
	assert.Equal(t, "อู่ช่างสมชาย", res[0].CustomerName)
	assert.Equal(t, 5.0, res[0].StandardDiscountRate)
	assert.True(t, res[0].IsDiscountEnabled)
	assert.Equal(t, 1, repo.calls["SearchCustomers"])
}

func TestGetCustomerDiscount_RepoError(t *testing.T) {
	repo := newMockCustomerDiscountRepo()
	service := posService.NewCustomerDiscountService(repo)

	repo.searchCustomersFn = func(query string) ([]entity.Customer, error) {
		return nil, errors.New("database connection failed")
	}

	res, err := service.GetCustomerDiscount("")

	require.Error(t, err)
	assert.Nil(t, res)
	assert.Equal(t, "database connection failed", err.Error())
}

func TestBulkUpdateCustomerDiscounts_Success(t *testing.T) {
	repo := newMockCustomerDiscountRepo()
	service := posService.NewCustomerDiscountService(repo)

	storedCustomer := &entity.Customer{
		Model:                gorm.Model{ID: 10},
		CustomerName:         "อู่สยามยนต์",
		StandardDiscountRate: 0.0,
		IsDiscountEnabled:    false,
	}

	repo.getCreditCustomerByIDFn = func(id uint) (*entity.Customer, error) {
		assert.Equal(t, uint(10), id)
		return storedCustomer, nil
	}

	repo.updateCustomerFn = func(c *entity.Customer) error {
		assert.Equal(t, uint(10), c.ID)
		assert.Equal(t, 7.5, c.StandardDiscountRate)
		assert.True(t, c.IsDiscountEnabled)
		return nil
	}

	req := &posDto.BulkUpdateCustomerDiscountRequest{
		DiscountItems: []posDto.UpdateCustomerDiscountItemRequest{
			{
				ID:                   10,
				StandardDiscountRate: 7.5,
				IsDiscountEnabled:    true,
			},
		},
	}

	err := service.BulkUpdateCustomerDiscounts(req)

	require.NoError(t, err)
	assert.Equal(t, 1, repo.calls["GetCreditCustomerByID"])
	assert.Equal(t, 1, repo.calls["UpdateCustomer"])
}

func TestBulkUpdateCustomerDiscounts_CustomerNotFound(t *testing.T) {
	repo := newMockCustomerDiscountRepo()
	service := posService.NewCustomerDiscountService(repo)

	repo.getCreditCustomerByIDFn = func(id uint) (*entity.Customer, error) {
		return nil, gorm.ErrRecordNotFound
	}

	req := &posDto.BulkUpdateCustomerDiscountRequest{
		DiscountItems: []posDto.UpdateCustomerDiscountItemRequest{
			{
				ID:                   999,
				StandardDiscountRate: 5.0,
				IsDiscountEnabled:    true,
			},
		},
	}

	err := service.BulkUpdateCustomerDiscounts(req)

	require.Error(t, err)
	assert.True(t, errors.Is(err, gorm.ErrRecordNotFound))
	assert.Equal(t, 0, repo.calls["UpdateCustomer"])
}

func TestGetCustomerDiscount_WithDebtAging(t *testing.T) {
	repo := newMockCustomerDiscountRepo()
	service := posService.NewCustomerDiscountService(repo)

	dummyCustomers := []entity.Customer{
		{
			Model:             gorm.Model{ID: 1},
			CustomerName:      "ลูกค้าค้างชำระนาน",
			CurrentDebtAmount: 15000.0,
		},
		{
			Model:             gorm.Model{ID: 2},
			CustomerName:      "ลูกค้าไม่มีหนี้",
			CurrentDebtAmount: 0.0,
		},
	}

	repo.searchCustomersFn = func(query string) ([]entity.Customer, error) {
		return dummyCustomers, nil
	}
	repo.getCustomersDebtAgingFn = func() (map[uint]posRepo.CustomerDebtAging, error) {
		return map[uint]posRepo.CustomerDebtAging{
			1: {
				CustomerID:     1,
				MaxUnpaidDays:  105,
				HasUnpaidOrder: true,
				IsOverdue:      true,
			},
		}, nil
	}

	res, err := service.GetCustomerDiscount("")

	require.NoError(t, err)
	require.Len(t, res, 2)
	// ลูกค้าที่ 1 มีหนี้ค้างและอายุหนี้ 105 วัน (เกินกำหนด)
	assert.Equal(t, 105, res[0].MaxUnpaidDays)
	assert.True(t, res[0].HasUnpaidOrder)
	assert.True(t, res[0].IsOverdue)
	// ลูกค้าที่ 2 ไม่มียอดหนี้
	assert.Equal(t, 0, res[1].MaxUnpaidDays)
	assert.False(t, res[1].HasUnpaidOrder)
	assert.False(t, res[1].IsOverdue)
}
