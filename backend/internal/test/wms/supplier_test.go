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

type mockSupplierRepo struct {
	createFn  func(*entity.Supplier) error
	getByIDFn func(uint) (*entity.Supplier, error)
	updateFn  func(*entity.Supplier) error
	deleteFn  func(uint) error
	listFn    func() ([]entity.Supplier, error)
	called    map[string]int
}

func newMockSupplierRepo() *mockSupplierRepo { return &mockSupplierRepo{called: map[string]int{}} }
func (m *mockSupplierRepo) track(n string)   { m.called[n]++ }
func (m *mockSupplierRepo) Create(s *entity.Supplier) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(s)
	}
	s.ID = 1
	return nil
}
func (m *mockSupplierRepo) GetByID(id uint) (*entity.Supplier, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockSupplierRepo) Update(s *entity.Supplier) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(s)
	}
	return nil
}
func (m *mockSupplierRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}
func (m *mockSupplierRepo) List() ([]entity.Supplier, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn()
	}
	return nil, nil
}

var _ wmsRepo.SupplierRepository = (*mockSupplierRepo)(nil)

func TestSupplierCreate_ReturnsCreatedEntityWithID(t *testing.T) {
	repo := newMockSupplierRepo()
	repo.createFn = func(s *entity.Supplier) error {
		s.ID = 42
		return nil
	}
	svc := wmsService.NewSupplierService(repo)

	dto, err := svc.Create(&wmsDTO.SupplierRequestDTO{
		SupplierName:      "บริษัท ไทยออโต้พาร์ท จำกัด",
		ShortSupplierName: "TAP",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	// ต้องคืน ID กลับไปด้วยทันที (ไม่ใช่แค่ message เฉยๆ) ให้ frontend เลือกใช้บริษัทที่เพิ่งสร้างต่อได้เลย
	if dto.ID != 42 {
		t.Errorf("expected created supplier ID 42 in response, got %d", dto.ID)
	}
	if dto.SupplierName != "บริษัท ไทยออโต้พาร์ท จำกัด" || dto.ShortSupplierName != "TAP" {
		t.Errorf("unexpected mapped response: %+v", dto)
	}
}

func TestSupplierCreate_RepoError_ReturnsNilAndError(t *testing.T) {
	repo := newMockSupplierRepo()
	wantErr := errors.New("duplicate email")
	repo.createFn = func(*entity.Supplier) error { return wantErr }
	svc := wmsService.NewSupplierService(repo)

	dto, err := svc.Create(&wmsDTO.SupplierRequestDTO{SupplierName: "x"})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
	if dto != nil {
		t.Errorf("expected nil response on error, got %+v", dto)
	}
}

func TestSupplierUpdate_SetsIDFromParam(t *testing.T) {
	repo := newMockSupplierRepo()
	var got entity.Supplier
	repo.updateFn = func(s *entity.Supplier) error {
		got = *s
		return nil
	}
	svc := wmsService.NewSupplierService(repo)

	err := svc.Update(9, &wmsDTO.SupplierRequestDTO{SupplierName: "บริษัท ใหม่", ShortSupplierName: "NEW"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != 9 {
		t.Errorf("expected entity ID to come from the path param (9), got %d", got.ID)
	}
	if got.SupplierName != "บริษัท ใหม่" {
		t.Errorf("unexpected mapped entity: %+v", got)
	}
}

func TestSupplierDelete_PassesIDAndError(t *testing.T) {
	repo := newMockSupplierRepo()
	wantErr := errors.New("has products")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewSupplierService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestSupplierList_MapsAll(t *testing.T) {
	repo := newMockSupplierRepo()
	repo.listFn = func() ([]entity.Supplier, error) {
		return []entity.Supplier{
			{Model: gorm.Model{ID: 1}, SupplierName: "A"},
			{Model: gorm.Model{ID: 2}, SupplierName: "B"},
		}, nil
	}
	svc := wmsService.NewSupplierService(repo)
	result, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 || result[0].SupplierName != "A" || result[1].SupplierName != "B" {
		t.Errorf("unexpected result: %+v", result)
	}
}
