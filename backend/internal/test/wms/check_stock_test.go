package wms

import (
	"errors"
	"testing"
	"time"

	wmsDTO "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"
)

// ---------------------------------------------------------------------------
// mockCheckStockRepo
// ---------------------------------------------------------------------------

type mockCheckStockRepo struct {
	createFn  func(*entity.CheckStock) error
	getByIDFn func(uint) (*entity.CheckStock, error)
	listFn    func(*uint) ([]entity.CheckStock, error)

	called map[string]int
}

func newMockCheckStockRepo() *mockCheckStockRepo {
	return &mockCheckStockRepo{called: map[string]int{}}
}

func (m *mockCheckStockRepo) track(name string) { m.called[name]++ }

func (m *mockCheckStockRepo) Create(cs *entity.CheckStock) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(cs)
	}
	cs.ID = 1
	return nil
}

func (m *mockCheckStockRepo) GetByID(id uint) (*entity.CheckStock, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}

func (m *mockCheckStockRepo) List(scheduleID *uint) ([]entity.CheckStock, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn(scheduleID)
	}
	return nil, nil
}

var _ wmsRepo.CheckStockRepository = (*mockCheckStockRepo)(nil)

// scheduleRepo ไม่ถูกเรียกใช้เลยโดย CheckStockService (CreateCheckStock/GetByID/List ทั้ง 3 เมธอด ไม่แตะ
// scheduleRepo) จึงส่ง nil ไปตรงๆ ได้อย่างปลอดภัยใน test พวกนี้ ไม่ต้องสร้าง fake ของ CheckStockScheduleRepository เพิ่ม
func newCheckStockServiceForTest(repo wmsRepo.CheckStockRepository) wmsService.CheckStockService {
	return wmsService.NewCheckStockService(repo, nil)
}

// ---------------------------------------------------------------------------
// CreateCheckStock
// ---------------------------------------------------------------------------

func TestCreateCheckStock_ComputesDiffQuantity(t *testing.T) {
	tests := []struct {
		name        string
		oldQty      int
		newQty      int
		wantDiffQty int
	}{
		{"counted more than system", 10, 15, 5},
		{"counted less than system", 10, 4, -6},
		{"counted exactly matches system", 10, 10, 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMockCheckStockRepo()
			var captured entity.CheckStock
			repo.createFn = func(cs *entity.CheckStock) error {
				captured = *cs
				return nil
			}
			svc := newCheckStockServiceForTest(repo)

			err := svc.CreateCheckStock(&wmsDTO.CheckStockRequestDTO{
				Old_Quantity:        tt.oldQty,
				New_Quantity:        tt.newQty,
				Adjustment_DateTime: time.Now(),
				ProductID:           1,
				UserID:              1,
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if captured.Diff_Quantity != tt.wantDiffQty {
				t.Errorf("expected diff quantity %d, got %d", tt.wantDiffQty, captured.Diff_Quantity)
			}
		})
	}
}

func TestCreateCheckStock_SupplierIDZero_StaysNilToAvoidFKViolation(t *testing.T) {
	repo := newMockCheckStockRepo()
	var captured entity.CheckStock
	repo.createFn = func(cs *entity.CheckStock) error {
		captured = *cs
		return nil
	}
	svc := newCheckStockServiceForTest(repo)

	err := svc.CreateCheckStock(&wmsDTO.CheckStockRequestDTO{
		Old_Quantity:        1,
		New_Quantity:        1,
		Adjustment_DateTime: time.Now(),
		ProductID:           1,
		UserID:              1,
		SupplierID:          0, // ไม่ได้ระบุ supplier มา
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.SupplierID != nil {
		t.Errorf("expected SupplierID to stay nil when request supplier_id is 0, got %v", *captured.SupplierID)
	}
}

func TestCreateCheckStock_SupplierIDProvided_IsSet(t *testing.T) {
	repo := newMockCheckStockRepo()
	var captured entity.CheckStock
	repo.createFn = func(cs *entity.CheckStock) error {
		captured = *cs
		return nil
	}
	svc := newCheckStockServiceForTest(repo)

	err := svc.CreateCheckStock(&wmsDTO.CheckStockRequestDTO{
		Old_Quantity:        1,
		New_Quantity:        1,
		Adjustment_DateTime: time.Now(),
		ProductID:           1,
		UserID:              1,
		SupplierID:          9,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.SupplierID == nil || *captured.SupplierID != 9 {
		t.Errorf("expected SupplierID 9, got %v", captured.SupplierID)
	}
}

func TestCreateCheckStock_RepoError_Propagates(t *testing.T) {
	repo := newMockCheckStockRepo()
	wantErr := errors.New("insert failed")
	repo.createFn = func(*entity.CheckStock) error { return wantErr }
	svc := newCheckStockServiceForTest(repo)

	err := svc.CreateCheckStock(&wmsDTO.CheckStockRequestDTO{
		Old_Quantity: 1, New_Quantity: 1, Adjustment_DateTime: time.Now(), ProductID: 1, UserID: 1,
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

// ---------------------------------------------------------------------------
// GetByID / List
// ---------------------------------------------------------------------------

func TestCheckStockGetByID_MapsOptionalPointerFieldsWhenPresent(t *testing.T) {
	repo := newMockCheckStockRepo()
	productID := uint(1)
	supplierID := uint(2)
	userID := uint(3)
	repo.getByIDFn = func(id uint) (*entity.CheckStock, error) {
		return &entity.CheckStock{
			Old_Quantity:  10,
			New_Quantity:  8,
			Diff_Quantity: -2,
			ProductID:     &productID,
			SupplierID:    &supplierID,
			UserID:        &userID,
		}, nil
	}
	svc := newCheckStockServiceForTest(repo)

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ProductID != productID || dto.SupplierID != supplierID || dto.UserID != userID {
		t.Errorf("unexpected mapped IDs: product=%d supplier=%d user=%d", dto.ProductID, dto.SupplierID, dto.UserID)
	}
}

func TestCheckStockGetByID_NilOptionalPointers_LeavesZeroValues(t *testing.T) {
	repo := newMockCheckStockRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStock, error) {
		return &entity.CheckStock{Old_Quantity: 10, New_Quantity: 10}, nil
	}
	svc := newCheckStockServiceForTest(repo)

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ProductID != 0 || dto.SupplierID != 0 || dto.UserID != 0 {
		t.Errorf("expected zero-value IDs when entity pointers are nil, got product=%d supplier=%d user=%d", dto.ProductID, dto.SupplierID, dto.UserID)
	}
}

func TestCheckStockGetByID_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockCheckStockRepo()
	wantErr := errors.New("record not found")
	repo.getByIDFn = func(uint) (*entity.CheckStock, error) { return nil, wantErr }
	svc := newCheckStockServiceForTest(repo)

	_, err := svc.GetByID(999)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestCheckStockList_PassesScheduleIDThroughAndMapsAll(t *testing.T) {
	repo := newMockCheckStockRepo()
	scheduleID := uint(5)
	var gotScheduleID *uint
	repo.listFn = func(id *uint) ([]entity.CheckStock, error) {
		gotScheduleID = id
		return []entity.CheckStock{{Old_Quantity: 1, New_Quantity: 2}, {Old_Quantity: 3, New_Quantity: 3}}, nil
	}
	svc := newCheckStockServiceForTest(repo)

	result, err := svc.List(&scheduleID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 mapped items, got %d", len(result))
	}
	if gotScheduleID != &scheduleID {
		t.Error("expected scheduleID pointer to be passed through unchanged")
	}
}

func TestCheckStockList_RepoError_Propagates(t *testing.T) {
	repo := newMockCheckStockRepo()
	wantErr := errors.New("query failed")
	repo.listFn = func(*uint) ([]entity.CheckStock, error) { return nil, wantErr }
	svc := newCheckStockServiceForTest(repo)

	_, err := svc.List(nil)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
