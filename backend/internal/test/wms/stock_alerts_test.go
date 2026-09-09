package wms

import (
	"errors"
	"testing"

	wmsDTO "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"

	"gorm.io/gorm"
)

type mockStockAlertRepo struct {
	createFn                        func(*entity.StockAlert) error
	getByIDFn                       func(uint) (*entity.StockAlert, error)
	listFn                          func(string) ([]entity.StockAlert, error)
	updateFn                        func(*entity.StockAlert) error
	resolveByIDsFn                  func([]uint) error
	getActivePOAlertMapFn           func([]uint) (map[uint]wmsRepo.ActivePOInfo, error)
	listLowStockProductsFn          func() ([]entity.Product, error)
	listUnresolvedAlertProductIDsFn func() (map[uint]bool, error)
	called                          map[string]int
}

func newMockStockAlertRepo() *mockStockAlertRepo {
	return &mockStockAlertRepo{called: map[string]int{}}
}
func (m *mockStockAlertRepo) track(n string) { m.called[n]++ }
func (m *mockStockAlertRepo) Create(sa *entity.StockAlert) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(sa)
	}
	sa.ID = 1
	return nil
}
func (m *mockStockAlertRepo) GetByID(id uint) (*entity.StockAlert, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockStockAlertRepo) List(isResolved string) ([]entity.StockAlert, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn(isResolved)
	}
	return nil, nil
}
func (m *mockStockAlertRepo) Update(sa *entity.StockAlert) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(sa)
	}
	return nil
}
func (m *mockStockAlertRepo) ResolveByIDs(ids []uint) error {
	m.track("ResolveByIDs")
	if m.resolveByIDsFn != nil {
		return m.resolveByIDsFn(ids)
	}
	return nil
}
func (m *mockStockAlertRepo) GetActivePOAlertMap(alertIDs []uint) (map[uint]wmsRepo.ActivePOInfo, error) {
	m.track("GetActivePOAlertMap")
	if m.getActivePOAlertMapFn != nil {
		return m.getActivePOAlertMapFn(alertIDs)
	}
	return map[uint]wmsRepo.ActivePOInfo{}, nil
}
func (m *mockStockAlertRepo) ListLowStockProducts() ([]entity.Product, error) {
	m.track("ListLowStockProducts")
	if m.listLowStockProductsFn != nil {
		return m.listLowStockProductsFn()
	}
	return nil, nil
}
func (m *mockStockAlertRepo) ListUnresolvedAlertProductIDs() (map[uint]bool, error) {
	m.track("ListUnresolvedAlertProductIDs")
	if m.listUnresolvedAlertProductIDsFn != nil {
		return m.listUnresolvedAlertProductIDsFn()
	}
	return map[uint]bool{}, nil
}

var _ wmsRepo.StockAlertRepository = (*mockStockAlertRepo)(nil)

func TestStockAlertCreate_DefaultsIsResolvedToFalseWhenOmitted(t *testing.T) {
	repo := newMockStockAlertRepo()
	var got entity.StockAlert
	repo.createFn = func(sa *entity.StockAlert) error {
		got = *sa
		return nil
	}
	svc := wmsService.NewStockAlertService(repo)

	err := svc.Create(&wmsDTO.StockAlertRequestDTO{
		Alert_type:        "LOW_STOCK",
		Quantity_At_Alert: 3,
		Limit_Quantity:    5,
		ProductID:         1,
		// Is_Resolved ไม่ได้ส่งมา
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Is_Resolved != "false" {
		t.Errorf("expected Is_Resolved to default to \"false\", got %q", got.Is_Resolved)
	}
	if got.ProductID == nil || *got.ProductID != 1 {
		t.Errorf("expected ProductID 1, got %v", got.ProductID)
	}
}

func TestStockAlertCreate_RespectsExplicitIsResolvedValue(t *testing.T) {
	repo := newMockStockAlertRepo()
	var got entity.StockAlert
	repo.createFn = func(sa *entity.StockAlert) error {
		got = *sa
		return nil
	}
	svc := wmsService.NewStockAlertService(repo)

	err := svc.Create(&wmsDTO.StockAlertRequestDTO{
		Alert_type: "LOW_STOCK", ProductID: 1, Is_Resolved: "true",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Is_Resolved != "true" {
		t.Errorf("expected explicit Is_Resolved value to be respected, got %q", got.Is_Resolved)
	}
}

func TestStockAlertGetByID_EnrichesFromProductAndLatestInventory(t *testing.T) {
	supplierID := uint(5)
	repo := newMockStockAlertRepo()
	repo.getByIDFn = func(id uint) (*entity.StockAlert, error) {
		return &entity.StockAlert{
			Model: gorm.Model{ID: id},
			Product: &entity.Product{
				Product_Name: "Turbocharger",
				Product_Code: "BR-900X",
				Cost_price:   500,
				Unit:         &entity.Unit{Unit_Name: "ชิ้น"},
				Inventories: []entity.Inventory{
					{SupplierID: supplierID, Supplier: &entity.Supplier{Model: gorm.Model{ID: supplierID}, SupplierName: "ABC Co."}},
				},
			},
		}, nil
	}
	svc := wmsService.NewStockAlertService(repo)

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ProductName != "Turbocharger" || dto.ProductCode != "BR-900X" || dto.CostPrice != 500 || dto.UnitName != "ชิ้น" {
		t.Errorf("unexpected product enrichment: %+v", dto)
	}
	if dto.SupplierID == nil || *dto.SupplierID != supplierID || dto.SupplierName != "ABC Co." {
		t.Errorf("expected supplier resolved from the first inventory row, got id=%v name=%q", dto.SupplierID, dto.SupplierName)
	}
}

func TestStockAlertGetByID_NilProduct_LeavesEnrichmentEmpty(t *testing.T) {
	repo := newMockStockAlertRepo()
	repo.getByIDFn = func(id uint) (*entity.StockAlert, error) {
		return &entity.StockAlert{Model: gorm.Model{ID: id}, Alert_type: "LOW_STOCK"}, nil
	}
	svc := wmsService.NewStockAlertService(repo)

	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ProductName != "" || dto.SupplierID != nil {
		t.Errorf("expected no enrichment when Product is nil, got %+v", dto)
	}
}

func TestStockAlertList_PassesFilterThrough(t *testing.T) {
	repo := newMockStockAlertRepo()
	var got string
	repo.listFn = func(isResolved string) ([]entity.StockAlert, error) {
		got = isResolved
		return []entity.StockAlert{{Model: gorm.Model{ID: 1}}}, nil
	}
	svc := wmsService.NewStockAlertService(repo)

	result, err := svc.List("false")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 || got != "false" {
		t.Errorf("expected filter to be passed through, got filter=%q results=%d", got, len(result))
	}
}

func TestStockAlertUpdateResolved_UpdatesIsResolvedField(t *testing.T) {
	repo := newMockStockAlertRepo()
	repo.getByIDFn = func(id uint) (*entity.StockAlert, error) {
		return &entity.StockAlert{Model: gorm.Model{ID: id}, Is_Resolved: "false"}, nil
	}
	var got entity.StockAlert
	repo.updateFn = func(sa *entity.StockAlert) error {
		got = *sa
		return nil
	}
	svc := wmsService.NewStockAlertService(repo)

	if err := svc.UpdateResolved(1, &wmsDTO.StockAlertUpdateDTO{Is_Resolved: "true"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Is_Resolved != "true" {
		t.Errorf("expected Is_Resolved updated to true, got %q", got.Is_Resolved)
	}
}

func TestCheckAndCreateAlerts_CreatesOnlyForProductsWithoutAnExistingUnresolvedAlert(t *testing.T) {
	repo := newMockStockAlertRepo()
	repo.listLowStockProductsFn = func() ([]entity.Product, error) {
		return []entity.Product{
			{Model: gorm.Model{ID: 1}, Product_Name: "ผ้าเบรก", Quantity: 2, Limit_Quantity: 5},
			{Model: gorm.Model{ID: 2}, Product_Name: "หัวเทียน", Quantity: 0, Limit_Quantity: 3},
			{Model: gorm.Model{ID: 3}, Product_Name: "กรองน้ำมัน", Quantity: 1, Limit_Quantity: 4}, // มี alert ค้างอยู่แล้ว
		}, nil
	}
	repo.listFn = func(string) ([]entity.StockAlert, error) {
		id := uint(3)
		return []entity.StockAlert{{ProductID: &id, Alert_type: "LOW_STOCK", Quantity_At_Alert: 1, Limit_Quantity: 4}}, nil
	}
	var createdAlerts []entity.StockAlert
	repo.createFn = func(sa *entity.StockAlert) error {
		sa.ID = uint(len(createdAlerts) + 1)
		createdAlerts = append(createdAlerts, *sa)
		return nil
	}
	svc := wmsService.NewStockAlertService(repo)

	result, err := svc.CheckAndCreateAlerts()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 new alerts (product 3 already has one), got %d", len(result))
	}
	if len(createdAlerts) != 2 {
		t.Fatalf("expected repo.Create called exactly twice, got %d", len(createdAlerts))
	}

	if result[0].ProductID == nil || *result[0].ProductID != 1 || result[0].Alert_type != "LOW_STOCK" || result[0].ProductName != "ผ้าเบรก" {
		t.Errorf("expected first alert to be LOW_STOCK for product 1, got %+v", result[0])
	}
	if result[1].ProductID == nil || *result[1].ProductID != 2 || result[1].Alert_type != "OUT_OF_STOCK" {
		t.Errorf("expected second alert to be OUT_OF_STOCK for product 2 (quantity 0), got %+v", result[1])
	}
	if createdAlerts[0].Is_Resolved != "false" {
		t.Errorf("expected newly created alerts to default to unresolved, got %q", createdAlerts[0].Is_Resolved)
	}
}

func TestCheckAndCreateAlerts_NoLowStockProducts_ReturnsEmptyWithoutTouchingUnresolvedLookup(t *testing.T) {
	repo := newMockStockAlertRepo()
	repo.listLowStockProductsFn = func() ([]entity.Product, error) { return nil, nil }
	svc := wmsService.NewStockAlertService(repo)

	result, err := svc.CheckAndCreateAlerts()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 0 {
		t.Errorf("expected no alerts created, got %d", len(result))
	}
	if repo.called["ListUnresolvedAlertProductIDs"] != 0 {
		t.Errorf("expected the unresolved-alert lookup to be skipped when there are no low-stock products")
	}
}

func TestCheckAndCreateAlerts_PropagatesLookupErrors(t *testing.T) {
	wantErr := errors.New("db unavailable")

	t.Run("ListLowStockProducts fails", func(t *testing.T) {
		repo := newMockStockAlertRepo()
		repo.listLowStockProductsFn = func() ([]entity.Product, error) { return nil, wantErr }
		svc := wmsService.NewStockAlertService(repo)
		if _, err := svc.CheckAndCreateAlerts(); !errors.Is(err, wantErr) {
			t.Fatalf("expected error %v, got %v", wantErr, err)
		}
	})

	t.Run("List active alerts fails", func(t *testing.T) {
		repo := newMockStockAlertRepo()
		repo.listLowStockProductsFn = func() ([]entity.Product, error) {
			return []entity.Product{{Model: gorm.Model{ID: 1}, Quantity: 1, Limit_Quantity: 5}}, nil
		}
		repo.listFn = func(string) ([]entity.StockAlert, error) { return nil, wantErr }
		svc := wmsService.NewStockAlertService(repo)
		if _, err := svc.CheckAndCreateAlerts(); !errors.Is(err, wantErr) {
			t.Fatalf("expected error %v, got %v", wantErr, err)
		}
	})
}

func TestStockAlertUpdateResolved_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockStockAlertRepo()
	wantErr := errors.New("not found")
	repo.getByIDFn = func(uint) (*entity.StockAlert, error) { return nil, wantErr }
	svc := wmsService.NewStockAlertService(repo)

	if err := svc.UpdateResolved(1, &wmsDTO.StockAlertUpdateDTO{Is_Resolved: "true"}); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
