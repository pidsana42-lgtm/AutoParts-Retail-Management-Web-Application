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
// mockStockMovementRepo
// ---------------------------------------------------------------------------

type mockStockMovementRepo struct {
	createFn  func(*entity.StockMovement) error
	getByIDFn func(uint) (*entity.StockMovement, error)
	listFn    func(string, *time.Time, *time.Time) ([]entity.StockMovement, error)

	called map[string]int
}

func newMockStockMovementRepo() *mockStockMovementRepo {
	return &mockStockMovementRepo{called: map[string]int{}}
}

func (m *mockStockMovementRepo) track(name string) { m.called[name]++ }

func (m *mockStockMovementRepo) Create(sm *entity.StockMovement) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(sm)
	}
	sm.ID = 1
	return nil
}

func (m *mockStockMovementRepo) GetByID(id uint) (*entity.StockMovement, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}

func (m *mockStockMovementRepo) List(movementType string, from, to *time.Time) ([]entity.StockMovement, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn(movementType, from, to)
	}
	return nil, nil
}

var _ wmsRepo.StockMovementRepository = (*mockStockMovementRepo)(nil)

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

func TestStockMovementCreate_MapsOptionalFKsOnlyWhenProvided(t *testing.T) {
	repo := newMockStockMovementRepo()
	var captured entity.StockMovement
	repo.createFn = func(sm *entity.StockMovement) error {
		captured = *sm
		return nil
	}

	svc := wmsService.NewStockMovementService(repo)
	req := &wmsDTO.StockMovementRequestDTO{
		Movement_Type:     "IN",
		Quantity:          10,
		Movement_DateTime: time.Now(),
		ProductID:         1,
		UserID:            2,
		// SupplierID / SaleOrderID / BillID ทั้งหมดปล่อยว่างไว้ (nil)
	}

	if err := svc.Create(req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.UserID == nil || *captured.UserID != 2 {
		t.Errorf("expected UserID to always be set (pointer to req.UserID), got %v", captured.UserID)
	}
	if captured.SupplierID != nil || captured.SaleOrderID != nil || captured.BillID != nil {
		t.Errorf("expected optional FKs to stay nil when not provided, got supplier=%v saleOrder=%v bill=%v",
			captured.SupplierID, captured.SaleOrderID, captured.BillID)
	}
}

func TestStockMovementCreate_SetsOptionalFKsWhenProvided(t *testing.T) {
	repo := newMockStockMovementRepo()
	var captured entity.StockMovement
	repo.createFn = func(sm *entity.StockMovement) error {
		captured = *sm
		return nil
	}

	supplierID := uint(5)
	saleOrderID := uint(6)
	billID := uint(7)
	svc := wmsService.NewStockMovementService(repo)
	req := &wmsDTO.StockMovementRequestDTO{
		Movement_Type:     "RETURN",
		Quantity:          3,
		Movement_DateTime: time.Now(),
		ProductID:         1,
		UserID:            2,
		SupplierID:        &supplierID,
		SaleOrderID:       &saleOrderID,
		BillID:            &billID,
	}

	if err := svc.Create(req); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.SupplierID == nil || *captured.SupplierID != supplierID {
		t.Errorf("expected SupplierID %d, got %v", supplierID, captured.SupplierID)
	}
	if captured.SaleOrderID == nil || *captured.SaleOrderID != saleOrderID {
		t.Errorf("expected SaleOrderID %d, got %v", saleOrderID, captured.SaleOrderID)
	}
	if captured.BillID == nil || *captured.BillID != billID {
		t.Errorf("expected BillID %d, got %v", billID, captured.BillID)
	}
}

func TestStockMovementCreate_RepoError_Propagates(t *testing.T) {
	repo := newMockStockMovementRepo()
	wantErr := errors.New("insert failed")
	repo.createFn = func(*entity.StockMovement) error { return wantErr }

	svc := wmsService.NewStockMovementService(repo)
	err := svc.Create(&wmsDTO.StockMovementRequestDTO{Movement_Type: "IN", Quantity: 1, ProductID: 1, UserID: 1})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

// ---------------------------------------------------------------------------
// GetByID / List — ตรวจการแปลง entity -> DTO เมื่อมี/ไม่มี Product, Supplier ผูกมา
// ---------------------------------------------------------------------------

func TestStockMovementGetByID_MapsProductAndSupplierNamesWhenPresent(t *testing.T) {
	repo := newMockStockMovementRepo()
	repo.getByIDFn = func(id uint) (*entity.StockMovement, error) {
		return &entity.StockMovement{
			Movement_Type: "IN",
			Quantity:      5,
			Product:       &entity.Product{Product_Name: "Oil Filter"},
			Supplier:      &entity.Supplier{SupplierName: "ABC Co."},
		}, nil
	}
	svc := wmsService.NewStockMovementService(repo)

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ProductName != "Oil Filter" || dto.SupplierName != "ABC Co." {
		t.Errorf("unexpected mapped names: product=%q supplier=%q", dto.ProductName, dto.SupplierName)
	}
}

func TestStockMovementGetByID_NilProductAndSupplier_LeavesNamesEmpty(t *testing.T) {
	repo := newMockStockMovementRepo()
	repo.getByIDFn = func(id uint) (*entity.StockMovement, error) {
		return &entity.StockMovement{Movement_Type: "IN", Quantity: 5}, nil
	}
	svc := wmsService.NewStockMovementService(repo)

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ProductName != "" || dto.SupplierName != "" {
		t.Errorf("expected empty names when Product/Supplier are nil, got product=%q supplier=%q", dto.ProductName, dto.SupplierName)
	}
}

func TestStockMovementGetByID_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockStockMovementRepo()
	wantErr := errors.New("record not found")
	repo.getByIDFn = func(uint) (*entity.StockMovement, error) { return nil, wantErr }
	svc := wmsService.NewStockMovementService(repo)

	_, err := svc.GetByID(999)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestStockMovementList_PassesFiltersThroughAndMapsAll(t *testing.T) {
	repo := newMockStockMovementRepo()
	var gotType string
	var gotFrom, gotTo *time.Time
	repo.listFn = func(movementType string, from, to *time.Time) ([]entity.StockMovement, error) {
		gotType, gotFrom, gotTo = movementType, from, to
		return []entity.StockMovement{
			{Movement_Type: "IN", Quantity: 1},
			{Movement_Type: "IN", Quantity: 2},
		}, nil
	}
	svc := wmsService.NewStockMovementService(repo)

	from := time.Now().AddDate(0, 0, -7)
	to := time.Now()
	result, err := svc.List("IN", &from, &to)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 mapped items, got %d", len(result))
	}
	if gotType != "IN" || gotFrom != &from || gotTo != &to {
		t.Error("expected filters to be passed through to the repository unchanged")
	}
}

func TestStockMovementList_RepoError_Propagates(t *testing.T) {
	repo := newMockStockMovementRepo()
	wantErr := errors.New("query failed")
	repo.listFn = func(string, *time.Time, *time.Time) ([]entity.StockMovement, error) { return nil, wantErr }
	svc := wmsService.NewStockMovementService(repo)

	_, err := svc.List("", nil, nil)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
