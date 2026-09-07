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
	createFn       func(*entity.StockAlert) error
	getByIDFn      func(uint) (*entity.StockAlert, error)
	listFn         func(string) ([]entity.StockAlert, error)
	updateFn       func(*entity.StockAlert) error
	resolveByIDsFn func([]uint) error
	called         map[string]int
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

func TestStockAlertUpdateResolved_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockStockAlertRepo()
	wantErr := errors.New("not found")
	repo.getByIDFn = func(uint) (*entity.StockAlert, error) { return nil, wantErr }
	svc := wmsService.NewStockAlertService(repo)

	if err := svc.UpdateResolved(1, &wmsDTO.StockAlertUpdateDTO{Is_Resolved: "true"}); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
