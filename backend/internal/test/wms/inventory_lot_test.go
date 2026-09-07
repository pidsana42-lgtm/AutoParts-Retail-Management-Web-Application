package wms

import (
	"errors"
	"testing"

	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"

	"gorm.io/gorm"
)

type mockInventoryLotRepo struct {
	listByProductFn        func(uint) ([]entity.Inventory, error)
	resolveCodeFn          func(string) (*entity.Inventory, error)
	backfillMissingCodesFn func(uint, bool) (int64, error)
	called                 map[string]int
}

func newMockInventoryLotRepo() *mockInventoryLotRepo {
	return &mockInventoryLotRepo{called: map[string]int{}}
}
func (m *mockInventoryLotRepo) track(n string) { m.called[n]++ }
func (m *mockInventoryLotRepo) ListByProduct(productID uint) ([]entity.Inventory, error) {
	m.track("ListByProduct")
	if m.listByProductFn != nil {
		return m.listByProductFn(productID)
	}
	return nil, nil
}
func (m *mockInventoryLotRepo) ResolveCode(code string) (*entity.Inventory, error) {
	m.track("ResolveCode")
	if m.resolveCodeFn != nil {
		return m.resolveCodeFn(code)
	}
	return nil, errors.New("not found")
}
func (m *mockInventoryLotRepo) BackfillMissingCodes(productID uint, allProducts bool) (int64, error) {
	m.track("BackfillMissingCodes")
	if m.backfillMissingCodesFn != nil {
		return m.backfillMissingCodesFn(productID, allProducts)
	}
	return 0, nil
}

var _ wmsRepo.InventoryLotRepository = (*mockInventoryLotRepo)(nil)

func TestInventoryLotListByProduct_MapsSupplierNameWhenPresent(t *testing.T) {
	repo := newMockInventoryLotRepo()
	repo.listByProductFn = func(productID uint) ([]entity.Inventory, error) {
		return []entity.Inventory{
			{
				Model:              gorm.Model{ID: 1},
				ProductID:          productID,
				SupplierID:         5,
				Supplier:           &entity.Supplier{SupplierName: "ABC Co."},
				Variant_Code:       "BR-900X-TAP",
				Inventory_Quantity: 10,
			},
		}, nil
	}
	svc := wmsService.NewInventoryLotService(repo)

	lots, err := svc.ListByProduct(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(lots) != 1 {
		t.Fatalf("expected 1 lot, got %d", len(lots))
	}
	if lots[0].SupplierName != "ABC Co." || lots[0].VariantCode != "BR-900X-TAP" || lots[0].Quantity != 10 {
		t.Errorf("unexpected mapped lot: %+v", lots[0])
	}
}

func TestInventoryLotListByProduct_NilSupplier_LeavesNameEmpty(t *testing.T) {
	repo := newMockInventoryLotRepo()
	repo.listByProductFn = func(uint) ([]entity.Inventory, error) {
		return []entity.Inventory{{Model: gorm.Model{ID: 1}}}, nil
	}
	svc := wmsService.NewInventoryLotService(repo)

	lots, err := svc.ListByProduct(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if lots[0].SupplierName != "" {
		t.Errorf("expected empty supplier name when Supplier is nil, got %q", lots[0].SupplierName)
	}
}

func TestInventoryLotResolveCode_MapsProductAndSupplierWhenPresent(t *testing.T) {
	repo := newMockInventoryLotRepo()
	repo.resolveCodeFn = func(code string) (*entity.Inventory, error) {
		return &entity.Inventory{
			ProductID:          8,
			SupplierID:         5,
			Variant_Code:       code,
			Inventory_Quantity: 3,
			Product:            &entity.Product{Product_Code: "BR-900X", Product_Name: "Turbocharger"},
			Supplier:           &entity.Supplier{SupplierName: "ABC Co."},
		}, nil
	}
	svc := wmsService.NewInventoryLotService(repo)

	res, err := svc.ResolveCode("BR-900X-TAP")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.ProductCode != "BR-900X" || res.ProductName != "Turbocharger" || res.SupplierName != "ABC Co." {
		t.Errorf("unexpected resolved lot: %+v", res)
	}
}

func TestInventoryLotResolveCode_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockInventoryLotRepo()
	wantErr := errors.New("code not found")
	repo.resolveCodeFn = func(string) (*entity.Inventory, error) { return nil, wantErr }
	svc := wmsService.NewInventoryLotService(repo)

	_, err := svc.ResolveCode("UNKNOWN")
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestInventoryLotBackfillMissingCodes_WrapsUpdatedCount(t *testing.T) {
	repo := newMockInventoryLotRepo()
	var gotProductID uint
	var gotAll bool
	repo.backfillMissingCodesFn = func(productID uint, allProducts bool) (int64, error) {
		gotProductID, gotAll = productID, allProducts
		return 7, nil
	}
	svc := wmsService.NewInventoryLotService(repo)

	res, err := svc.BackfillMissingCodes(0, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Updated != 7 {
		t.Errorf("expected Updated 7, got %d", res.Updated)
	}
	if gotProductID != 0 || !gotAll {
		t.Errorf("expected filters passed through unchanged, got productID=%d all=%v", gotProductID, gotAll)
	}
}

func TestInventoryLotBackfillMissingCodes_RepoError_Propagates(t *testing.T) {
	repo := newMockInventoryLotRepo()
	wantErr := errors.New("update failed")
	repo.backfillMissingCodesFn = func(uint, bool) (int64, error) { return 0, wantErr }
	svc := wmsService.NewInventoryLotService(repo)

	_, err := svc.BackfillMissingCodes(1, false)
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
