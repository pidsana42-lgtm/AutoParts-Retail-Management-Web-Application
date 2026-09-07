package wms

// เทสของ Grade / Unit / Zone — CRUD ง่ายๆ ที่มีฟิลด์ตัวเองแค่ชื่อเดียว รูปแบบเหมือนกันทุกตัว
// (Update: "ไม่ส่งชื่อมา = ไม่แก้", Zone ต่างจากอีกสองตัวตรงไม่มี guard "ชื่อว่างไม่แก้" ที่ Update)

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
// Grade
// ---------------------------------------------------------------------------

type mockGradeRepo struct {
	createFn  func(*entity.Grade) error
	getByIDFn func(uint) (*entity.Grade, error)
	listFn    func() ([]entity.Grade, error)
	updateFn  func(*entity.Grade) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockGradeRepo() *mockGradeRepo  { return &mockGradeRepo{called: map[string]int{}} }
func (m *mockGradeRepo) track(n string) { m.called[n]++ }
func (m *mockGradeRepo) Create(g *entity.Grade) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(g)
	}
	g.ID = 1
	return nil
}
func (m *mockGradeRepo) GetByID(id uint) (*entity.Grade, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockGradeRepo) List() ([]entity.Grade, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn()
	}
	return nil, nil
}
func (m *mockGradeRepo) Update(g *entity.Grade) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(g)
	}
	return nil
}
func (m *mockGradeRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.GradeRepository = (*mockGradeRepo)(nil)

func TestGradeCreate_MapsName(t *testing.T) {
	repo := newMockGradeRepo()
	var got entity.Grade
	repo.createFn = func(g *entity.Grade) error {
		got = *g
		return nil
	}
	svc := wmsService.NewGradeService(repo)
	if err := svc.Create(&wmsDTO.GradeRequestDTO{Grade_Name: "A"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Grade_Name != "A" {
		t.Errorf("expected grade name A, got %q", got.Grade_Name)
	}
}

func TestGradeUpdate_BlankNameLeavesExistingValue(t *testing.T) {
	repo := newMockGradeRepo()
	repo.getByIDFn = func(id uint) (*entity.Grade, error) {
		return &entity.Grade{Model: gorm.Model{ID: id}, Grade_Name: "A"}, nil
	}
	var got entity.Grade
	repo.updateFn = func(g *entity.Grade) error {
		got = *g
		return nil
	}
	svc := wmsService.NewGradeService(repo)
	if err := svc.Update(1, &wmsDTO.GradeUpdateDTO{Grade_Name: ""}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Grade_Name != "A" {
		t.Errorf("expected existing name A to be kept when update sends blank, got %q", got.Grade_Name)
	}
}

func TestGradeUpdate_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockGradeRepo()
	wantErr := errors.New("not found")
	repo.getByIDFn = func(uint) (*entity.Grade, error) { return nil, wantErr }
	svc := wmsService.NewGradeService(repo)
	if err := svc.Update(1, &wmsDTO.GradeUpdateDTO{Grade_Name: "B"}); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestGradeDelete_PassesIDAndError(t *testing.T) {
	repo := newMockGradeRepo()
	wantErr := errors.New("in use")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewGradeService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestGradeList_MapsAll(t *testing.T) {
	repo := newMockGradeRepo()
	repo.listFn = func() ([]entity.Grade, error) {
		return []entity.Grade{{Model: gorm.Model{ID: 1}, Grade_Name: "A"}, {Model: gorm.Model{ID: 2}, Grade_Name: "B"}}, nil
	}
	svc := wmsService.NewGradeService(repo)
	result, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 || result[0].Grade_Name != "A" || result[1].Grade_Name != "B" {
		t.Errorf("unexpected result: %+v", result)
	}
}

// ---------------------------------------------------------------------------
// Unit
// ---------------------------------------------------------------------------

type mockUnitRepo struct {
	createFn  func(*entity.Unit) error
	getByIDFn func(uint) (*entity.Unit, error)
	listFn    func() ([]entity.Unit, error)
	updateFn  func(*entity.Unit) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockUnitRepo() *mockUnitRepo   { return &mockUnitRepo{called: map[string]int{}} }
func (m *mockUnitRepo) track(n string) { m.called[n]++ }
func (m *mockUnitRepo) Create(u *entity.Unit) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(u)
	}
	u.ID = 1
	return nil
}
func (m *mockUnitRepo) GetByID(id uint) (*entity.Unit, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockUnitRepo) List() ([]entity.Unit, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn()
	}
	return nil, nil
}
func (m *mockUnitRepo) Update(u *entity.Unit) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(u)
	}
	return nil
}
func (m *mockUnitRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.UnitRepository = (*mockUnitRepo)(nil)

func TestUnitCreate_MapsName(t *testing.T) {
	repo := newMockUnitRepo()
	var got entity.Unit
	repo.createFn = func(u *entity.Unit) error {
		got = *u
		return nil
	}
	svc := wmsService.NewUnitService(repo)
	if err := svc.Create(&wmsDTO.UnitRequestDTO{Unit_Name: "ชิ้น"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Unit_Name != "ชิ้น" {
		t.Errorf("expected unit name ชิ้น, got %q", got.Unit_Name)
	}
}

func TestUnitUpdate_BlankNameLeavesExistingValue(t *testing.T) {
	repo := newMockUnitRepo()
	repo.getByIDFn = func(id uint) (*entity.Unit, error) {
		return &entity.Unit{Model: gorm.Model{ID: id}, Unit_Name: "ชิ้น"}, nil
	}
	var got entity.Unit
	repo.updateFn = func(u *entity.Unit) error {
		got = *u
		return nil
	}
	svc := wmsService.NewUnitService(repo)
	if err := svc.Update(1, &wmsDTO.UnitUpdateDTO{Unit_Name: ""}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Unit_Name != "ชิ้น" {
		t.Errorf("expected existing name to be kept when update sends blank, got %q", got.Unit_Name)
	}
}

func TestUnitDelete_PassesIDAndError(t *testing.T) {
	repo := newMockUnitRepo()
	wantErr := errors.New("in use")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewUnitService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestUnitList_MapsAll(t *testing.T) {
	repo := newMockUnitRepo()
	repo.listFn = func() ([]entity.Unit, error) {
		return []entity.Unit{{Model: gorm.Model{ID: 1}, Unit_Name: "ชิ้น"}}, nil
	}
	svc := wmsService.NewUnitService(repo)
	result, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 || result[0].Unit_Name != "ชิ้น" {
		t.Errorf("unexpected result: %+v", result)
	}
}

// ---------------------------------------------------------------------------
// Zone
// ---------------------------------------------------------------------------

type mockZoneRepo struct {
	createFn  func(*entity.Zone) error
	getByIDFn func(uint) (*entity.Zone, error)
	listFn    func() ([]entity.Zone, error)
	updateFn  func(*entity.Zone) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockZoneRepo() *mockZoneRepo   { return &mockZoneRepo{called: map[string]int{}} }
func (m *mockZoneRepo) track(n string) { m.called[n]++ }
func (m *mockZoneRepo) Create(z *entity.Zone) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(z)
	}
	z.ID = 1
	return nil
}
func (m *mockZoneRepo) GetByID(id uint) (*entity.Zone, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockZoneRepo) List() ([]entity.Zone, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn()
	}
	return nil, nil
}
func (m *mockZoneRepo) Update(z *entity.Zone) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(z)
	}
	return nil
}
func (m *mockZoneRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.ZoneRepository = (*mockZoneRepo)(nil)

func TestZoneCreate_MapsName(t *testing.T) {
	repo := newMockZoneRepo()
	var got entity.Zone
	repo.createFn = func(z *entity.Zone) error {
		got = *z
		return nil
	}
	svc := wmsService.NewZoneService(repo)
	if err := svc.Create(&wmsDTO.ZoneRequestDTO{Zone_Name: "Zone A"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Zone_Name != "Zone A" {
		t.Errorf("expected zone name Zone A, got %q", got.Zone_Name)
	}
}

func TestZoneUpdate_BlankNameLeavesExistingValue(t *testing.T) {
	repo := newMockZoneRepo()
	repo.getByIDFn = func(id uint) (*entity.Zone, error) {
		return &entity.Zone{Model: gorm.Model{ID: id}, Zone_Name: "Zone A"}, nil
	}
	var got entity.Zone
	repo.updateFn = func(z *entity.Zone) error {
		got = *z
		return nil
	}
	svc := wmsService.NewZoneService(repo)
	if err := svc.Update(1, &wmsDTO.ZoneUpdateDTO{Zone_Name: ""}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Zone_Name != "Zone A" {
		t.Errorf("expected existing name to be kept when update sends blank, got %q", got.Zone_Name)
	}
}

func TestZoneGetByID_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockZoneRepo()
	wantErr := errors.New("not found")
	repo.getByIDFn = func(uint) (*entity.Zone, error) { return nil, wantErr }
	svc := wmsService.NewZoneService(repo)
	if _, err := svc.GetByID(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestZoneDelete_PassesIDAndError(t *testing.T) {
	repo := newMockZoneRepo()
	wantErr := errors.New("in use")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewZoneService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
