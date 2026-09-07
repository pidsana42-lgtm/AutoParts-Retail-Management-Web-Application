package wms

// เทสของ Shelf / ShelfLevel — ลำดับชั้นตำแหน่งจัดเก็บ (โซน > ตู้/ชั้นวาง > ชั้นระดับ)

import (
	"errors"
	"testing"

	wmsDTO "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"

	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// Shelf
// ---------------------------------------------------------------------------

type mockShelfRepo struct {
	createFn  func(*entity.Shelf) error
	getByIDFn func(uint) (*entity.Shelf, error)
	listFn    func() ([]entity.Shelf, error)
	updateFn  func(*entity.Shelf) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockShelfRepo() *mockShelfRepo  { return &mockShelfRepo{called: map[string]int{}} }
func (m *mockShelfRepo) track(n string) { m.called[n]++ }
func (m *mockShelfRepo) Create(s *entity.Shelf) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(s)
	}
	s.ID = 1
	return nil
}
func (m *mockShelfRepo) GetByID(id uint) (*entity.Shelf, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockShelfRepo) List() ([]entity.Shelf, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn()
	}
	return nil, nil
}
func (m *mockShelfRepo) Update(s *entity.Shelf) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(s)
	}
	return nil
}
func (m *mockShelfRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.ShelfRepository = (*mockShelfRepo)(nil)

func TestShelfCreate_MapsNameAndZoneID(t *testing.T) {
	repo := newMockShelfRepo()
	var got entity.Shelf
	repo.createFn = func(s *entity.Shelf) error {
		got = *s
		return nil
	}
	svc := wmsService.NewShelfService(repo)
	if err := svc.Create(&wmsDTO.ShelfRequestDTO{Shelf_Name: "A1", ZoneID: 3}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Shelf_Name != "A1" || got.ZoneID != 3 {
		t.Errorf("unexpected mapped entity: %+v", got)
	}
}

func TestShelfUpdate_BlankNameAndZeroZoneIDKeepExistingValues(t *testing.T) {
	repo := newMockShelfRepo()
	repo.getByIDFn = func(id uint) (*entity.Shelf, error) {
		return &entity.Shelf{Model: gorm.Model{ID: id}, Shelf_Name: "A1", ZoneID: 3}, nil
	}
	var got entity.Shelf
	repo.updateFn = func(s *entity.Shelf) error {
		got = *s
		return nil
	}
	svc := wmsService.NewShelfService(repo)
	if err := svc.Update(1, &wmsDTO.ShelfUpdateDTO{Shelf_Name: "", ZoneID: 0}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Shelf_Name != "A1" {
		t.Errorf("expected existing shelf name to be kept when update sends blank, got %q", got.Shelf_Name)
	}
	if got.ZoneID != 3 {
		t.Errorf("expected existing ZoneID to be kept when update sends 0, got %d", got.ZoneID)
	}
}

func TestShelfUpdate_NonZeroZoneIDOverwritesExisting(t *testing.T) {
	repo := newMockShelfRepo()
	repo.getByIDFn = func(id uint) (*entity.Shelf, error) {
		return &entity.Shelf{Model: gorm.Model{ID: id}, Shelf_Name: "A1", ZoneID: 3}, nil
	}
	var got entity.Shelf
	repo.updateFn = func(s *entity.Shelf) error {
		got = *s
		return nil
	}
	svc := wmsService.NewShelfService(repo)
	if err := svc.Update(1, &wmsDTO.ShelfUpdateDTO{ZoneID: 5}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ZoneID != 5 {
		t.Errorf("expected ZoneID to be updated to 5, got %d", got.ZoneID)
	}
}

func TestShelfGetByID_MapsNestedShelfLevels(t *testing.T) {
	repo := newMockShelfRepo()
	repo.getByIDFn = func(id uint) (*entity.Shelf, error) {
		return &entity.Shelf{
			Model:      gorm.Model{ID: id},
			Shelf_Name: "A1",
			ShelfLevels: []entity.ShelfLevel{
				{Model: gorm.Model{ID: 1}, Level_Name: "ชั้น 1"},
			},
		}, nil
	}
	svc := wmsService.NewShelfService(repo)
	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dto.ShelfLevels) != 1 || dto.ShelfLevels[0].Level_Name != "ชั้น 1" {
		t.Errorf("expected nested shelf levels to be mapped, got %+v", dto.ShelfLevels)
	}
}

func TestShelfGetByID_NoLevels_ReturnsEmptySliceNotNil(t *testing.T) {
	repo := newMockShelfRepo()
	repo.getByIDFn = func(id uint) (*entity.Shelf, error) {
		return &entity.Shelf{Model: gorm.Model{ID: id}, Shelf_Name: "A1"}, nil
	}
	svc := wmsService.NewShelfService(repo)
	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.ShelfLevels == nil {
		t.Error("expected ShelfLevels to be an empty slice (not nil) so it serializes as [] instead of null")
	}
}

func TestShelfDelete_PassesIDAndError(t *testing.T) {
	repo := newMockShelfRepo()
	wantErr := errors.New("has products")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewShelfService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

// ---------------------------------------------------------------------------
// ShelfLevel
// ---------------------------------------------------------------------------

type mockShelfLevelRepo struct {
	createFn  func(*entity.ShelfLevel) error
	getByIDFn func(uint) (*entity.ShelfLevel, error)
	updateFn  func(*entity.ShelfLevel) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockShelfLevelRepo() *mockShelfLevelRepo {
	return &mockShelfLevelRepo{called: map[string]int{}}
}
func (m *mockShelfLevelRepo) track(n string) { m.called[n]++ }
func (m *mockShelfLevelRepo) Create(l *entity.ShelfLevel) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(l)
	}
	l.ID = 1
	return nil
}
func (m *mockShelfLevelRepo) GetByID(id uint) (*entity.ShelfLevel, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockShelfLevelRepo) Update(l *entity.ShelfLevel) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(l)
	}
	return nil
}
func (m *mockShelfLevelRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.ShelfLevelRepository = (*mockShelfLevelRepo)(nil)

func TestShelfLevelCreate_MapsNameAndShelfID(t *testing.T) {
	repo := newMockShelfLevelRepo()
	var got entity.ShelfLevel
	repo.createFn = func(l *entity.ShelfLevel) error {
		got = *l
		return nil
	}
	svc := wmsService.NewShelfLevelService(repo)
	if err := svc.Create(&wmsDTO.ShelfLevelRequestDTO{Level_Name: "ชั้น 1", ShelfID: 4}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Level_Name != "ชั้น 1" || got.ShelfID != 4 {
		t.Errorf("unexpected mapped entity: %+v", got)
	}
}

func TestShelfLevelUpdate_ZeroShelfIDLeavesExisting(t *testing.T) {
	repo := newMockShelfLevelRepo()
	repo.getByIDFn = func(id uint) (*entity.ShelfLevel, error) {
		return &entity.ShelfLevel{Model: gorm.Model{ID: id}, Level_Name: "ชั้น 1", ShelfID: 4}, nil
	}
	var got entity.ShelfLevel
	repo.updateFn = func(l *entity.ShelfLevel) error {
		got = *l
		return nil
	}
	svc := wmsService.NewShelfLevelService(repo)
	if err := svc.Update(1, &wmsDTO.ShelfLevelUpdateDTO{Level_Name: "ชั้น 2", ShelfID: 0}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ShelfID != 4 {
		t.Errorf("expected ShelfID to stay 4 when update sends 0, got %d", got.ShelfID)
	}
	if got.Level_Name != "ชั้น 2" {
		t.Errorf("expected level name to be updated, got %q", got.Level_Name)
	}
}

func TestShelfLevelUpdate_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockShelfLevelRepo()
	wantErr := errors.New("not found")
	repo.getByIDFn = func(uint) (*entity.ShelfLevel, error) { return nil, wantErr }
	svc := wmsService.NewShelfLevelService(repo)
	if err := svc.Update(1, &wmsDTO.ShelfLevelUpdateDTO{Level_Name: "ชั้น 2", ShelfID: 4}); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestShelfLevelDelete_PassesIDAndError(t *testing.T) {
	repo := newMockShelfLevelRepo()
	wantErr := errors.New("has products")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewShelfLevelService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
