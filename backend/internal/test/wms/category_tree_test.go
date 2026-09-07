package wms

// เทสของ Category / SubCategory / SubSubCategory — โครงสร้างหมวดหมู่สินค้า 3 ระดับ

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
// Category
// ---------------------------------------------------------------------------

type mockCategoryRepo struct {
	createFn  func(*entity.Category) error
	getByIDFn func(uint) (*entity.Category, error)
	listFn    func() ([]entity.Category, error)
	updateFn  func(*entity.Category) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockCategoryRepo() *mockCategoryRepo { return &mockCategoryRepo{called: map[string]int{}} }
func (m *mockCategoryRepo) track(n string)   { m.called[n]++ }
func (m *mockCategoryRepo) Create(c *entity.Category) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(c)
	}
	c.ID = 1
	return nil
}
func (m *mockCategoryRepo) GetByID(id uint) (*entity.Category, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockCategoryRepo) List() ([]entity.Category, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn()
	}
	return nil, nil
}
func (m *mockCategoryRepo) Update(c *entity.Category) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(c)
	}
	return nil
}
func (m *mockCategoryRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.CategoryRepository = (*mockCategoryRepo)(nil)

func TestCategoryCreate_MapsAllFields(t *testing.T) {
	repo := newMockCategoryRepo()
	var got entity.Category
	repo.createFn = func(c *entity.Category) error {
		got = *c
		return nil
	}
	svc := wmsService.NewCategoryService(repo)
	err := svc.Create(&wmsDTO.CategoryRequestDTO{
		Category_Name:       "Engine Parts",
		Category_Short_Name: "ENG",
		Description:         "อะไหล่เครื่องยนต์",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Category_Name != "Engine Parts" || got.Category_Short_Name != "ENG" || got.Description != "อะไหล่เครื่องยนต์" {
		t.Errorf("unexpected mapped entity: %+v", got)
	}
}

func TestCategoryUpdate_OnlyOverwritesNonBlankFields(t *testing.T) {
	repo := newMockCategoryRepo()
	repo.getByIDFn = func(id uint) (*entity.Category, error) {
		return &entity.Category{
			Model:               gorm.Model{ID: id},
			Category_Name:       "Engine Parts",
			Category_Short_Name: "ENG",
			Description:         "เดิม",
		}, nil
	}
	var got entity.Category
	repo.updateFn = func(c *entity.Category) error {
		got = *c
		return nil
	}
	svc := wmsService.NewCategoryService(repo)
	// ส่งมาแค่ Description ตัวเดียว ชื่อ/ชื่อย่อต้องคงของเดิมไว้
	err := svc.Update(1, &wmsDTO.CategoryUpdateDTO{Description: "ใหม่"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Category_Name != "Engine Parts" || got.Category_Short_Name != "ENG" {
		t.Errorf("expected name/short name to stay unchanged, got %+v", got)
	}
	if got.Description != "ใหม่" {
		t.Errorf("expected description to be updated to ใหม่, got %q", got.Description)
	}
}

func TestCategoryGetByID_MapsSubCategoriesInResponse(t *testing.T) {
	repo := newMockCategoryRepo()
	repo.getByIDFn = func(id uint) (*entity.Category, error) {
		return &entity.Category{
			Model:         gorm.Model{ID: id},
			Category_Name: "Engine Parts",
			SubCategories: []entity.SubCategory{
				{Model: gorm.Model{ID: 10}, Sub_Category_Name: "Filters"},
			},
		}, nil
	}
	svc := wmsService.NewCategoryService(repo)
	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dto.SubCategories) != 1 || dto.SubCategories[0].Sub_Category_Name != "Filters" {
		t.Errorf("expected nested sub-categories to be mapped, got %+v", dto.SubCategories)
	}
}

func TestCategoryDelete_PassesIDAndError(t *testing.T) {
	repo := newMockCategoryRepo()
	wantErr := errors.New("has products")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewCategoryService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

// ---------------------------------------------------------------------------
// SubCategory
// ---------------------------------------------------------------------------

type mockSubCategoryRepo struct {
	createFn  func(*entity.SubCategory) error
	getByIDFn func(uint) (*entity.SubCategory, error)
	listFn    func(*uint) ([]entity.SubCategory, error)
	updateFn  func(*entity.SubCategory) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockSubCategoryRepo() *mockSubCategoryRepo {
	return &mockSubCategoryRepo{called: map[string]int{}}
}
func (m *mockSubCategoryRepo) track(n string) { m.called[n]++ }
func (m *mockSubCategoryRepo) Create(sc *entity.SubCategory) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(sc)
	}
	sc.ID = 1
	return nil
}
func (m *mockSubCategoryRepo) GetByID(id uint) (*entity.SubCategory, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockSubCategoryRepo) List(categoryID *uint) ([]entity.SubCategory, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn(categoryID)
	}
	return nil, nil
}
func (m *mockSubCategoryRepo) Update(sc *entity.SubCategory) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(sc)
	}
	return nil
}
func (m *mockSubCategoryRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.SubCategoryRepository = (*mockSubCategoryRepo)(nil)

func TestSubCategoryCreate_MapsCategoryIDAsPointer(t *testing.T) {
	repo := newMockSubCategoryRepo()
	var got entity.SubCategory
	repo.createFn = func(sc *entity.SubCategory) error {
		got = *sc
		return nil
	}
	svc := wmsService.NewSubCategoryService(repo)
	if err := svc.Create(&wmsDTO.SubCategoryRequestDTO{Sub_Category_Name: "Filters", CategoryID: 7}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.CategoryID == nil || *got.CategoryID != 7 {
		t.Errorf("expected CategoryID 7, got %v", got.CategoryID)
	}
}

func TestSubCategoryUpdate_NilCategoryIDLeavesExistingCategory(t *testing.T) {
	repo := newMockSubCategoryRepo()
	existingCategoryID := uint(7)
	repo.getByIDFn = func(id uint) (*entity.SubCategory, error) {
		return &entity.SubCategory{Model: gorm.Model{ID: id}, Sub_Category_Name: "Filters", CategoryID: &existingCategoryID}, nil
	}
	var got entity.SubCategory
	repo.updateFn = func(sc *entity.SubCategory) error {
		got = *sc
		return nil
	}
	svc := wmsService.NewSubCategoryService(repo)
	if err := svc.Update(1, &wmsDTO.SubCategoryUpdateDTO{Sub_Category_Name: "Oil Filters"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.CategoryID == nil || *got.CategoryID != 7 {
		t.Errorf("expected CategoryID to stay 7 when update omits it, got %v", got.CategoryID)
	}
	if got.Sub_Category_Name != "Oil Filters" {
		t.Errorf("expected name to be updated, got %q", got.Sub_Category_Name)
	}
}

func TestSubCategoryGetByID_ResolvesCategoryNameWhenPreloaded(t *testing.T) {
	repo := newMockSubCategoryRepo()
	repo.getByIDFn = func(id uint) (*entity.SubCategory, error) {
		return &entity.SubCategory{
			Model:             gorm.Model{ID: id},
			Sub_Category_Name: "Filters",
			Category:          &entity.Category{Category_Name: "Engine Parts"},
		}, nil
	}
	svc := wmsService.NewSubCategoryService(repo)
	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.CategoryName != "Engine Parts" {
		t.Errorf("expected category name Engine Parts, got %q", dto.CategoryName)
	}
}

func TestSubCategoryList_PassesCategoryIDFilterThrough(t *testing.T) {
	repo := newMockSubCategoryRepo()
	filterID := uint(7)
	var gotFilter *uint
	repo.listFn = func(categoryID *uint) ([]entity.SubCategory, error) {
		gotFilter = categoryID
		return []entity.SubCategory{{Model: gorm.Model{ID: 1}, Sub_Category_Name: "Filters"}}, nil
	}
	svc := wmsService.NewSubCategoryService(repo)
	result, err := svc.List(&filterID)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 {
		t.Fatalf("expected 1 mapped item, got %d", len(result))
	}
	if gotFilter != &filterID {
		t.Error("expected the categoryID filter pointer to be passed through unchanged")
	}
}

// ---------------------------------------------------------------------------
// SubSubCategory
// ---------------------------------------------------------------------------

type mockSubSubCategoryRepo struct {
	createFn  func(*entity.SubSubCategory) error
	getByIDFn func(uint) (*entity.SubSubCategory, error)
	listFn    func(*uint) ([]entity.SubSubCategory, error)
	updateFn  func(*entity.SubSubCategory) error
	deleteFn  func(uint) error
	called    map[string]int
}

func newMockSubSubCategoryRepo() *mockSubSubCategoryRepo {
	return &mockSubSubCategoryRepo{called: map[string]int{}}
}
func (m *mockSubSubCategoryRepo) track(n string) { m.called[n]++ }
func (m *mockSubSubCategoryRepo) Create(ssc *entity.SubSubCategory) error {
	m.track("Create")
	if m.createFn != nil {
		return m.createFn(ssc)
	}
	ssc.ID = 1
	return nil
}
func (m *mockSubSubCategoryRepo) GetByID(id uint) (*entity.SubSubCategory, error) {
	m.track("GetByID")
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, errors.New("not found")
}
func (m *mockSubSubCategoryRepo) List(subCategoryID *uint) ([]entity.SubSubCategory, error) {
	m.track("List")
	if m.listFn != nil {
		return m.listFn(subCategoryID)
	}
	return nil, nil
}
func (m *mockSubSubCategoryRepo) Update(ssc *entity.SubSubCategory) error {
	m.track("Update")
	if m.updateFn != nil {
		return m.updateFn(ssc)
	}
	return nil
}
func (m *mockSubSubCategoryRepo) Delete(id uint) error {
	m.track("Delete")
	if m.deleteFn != nil {
		return m.deleteFn(id)
	}
	return nil
}

var _ wmsRepo.SubSubCategoryRepository = (*mockSubSubCategoryRepo)(nil)

func TestSubSubCategoryCreate_MapsSubCategoryIDAsPointer(t *testing.T) {
	repo := newMockSubSubCategoryRepo()
	var got entity.SubSubCategory
	repo.createFn = func(ssc *entity.SubSubCategory) error {
		got = *ssc
		return nil
	}
	svc := wmsService.NewSubSubCategoryService(repo)
	err := svc.Create(&wmsDTO.SubSubCategoryRequestDTO{Sub_Sub_Category_Name: "Oil Filters", SubCategoryID: 10})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.SubCategoryID == nil || *got.SubCategoryID != 10 {
		t.Errorf("expected SubCategoryID 10, got %v", got.SubCategoryID)
	}
}

func TestSubSubCategoryUpdate_NilSubCategoryIDLeavesExisting(t *testing.T) {
	repo := newMockSubSubCategoryRepo()
	existingID := uint(10)
	repo.getByIDFn = func(id uint) (*entity.SubSubCategory, error) {
		return &entity.SubSubCategory{Model: gorm.Model{ID: id}, Sub_Sub_Category_Name: "Oil Filters", SubCategoryID: &existingID}, nil
	}
	var got entity.SubSubCategory
	repo.updateFn = func(ssc *entity.SubSubCategory) error {
		got = *ssc
		return nil
	}
	svc := wmsService.NewSubSubCategoryService(repo)
	err := svc.Update(1, &wmsDTO.SubSubCategoryUpdateDTO{Sub_Sub_Category_Name: "Synthetic Oil Filters"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.SubCategoryID == nil || *got.SubCategoryID != 10 {
		t.Errorf("expected SubCategoryID to stay 10, got %v", got.SubCategoryID)
	}
}

func TestSubSubCategoryGetByID_ResolvesSubCategoryNameWhenPreloaded(t *testing.T) {
	repo := newMockSubSubCategoryRepo()
	repo.getByIDFn = func(id uint) (*entity.SubSubCategory, error) {
		return &entity.SubSubCategory{
			Model:                 gorm.Model{ID: id},
			Sub_Sub_Category_Name: "Oil Filters",
			SubCategory:           &entity.SubCategory{Sub_Category_Name: "Filters"},
		}, nil
	}
	svc := wmsService.NewSubSubCategoryService(repo)
	dto, err := svc.GetByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dto.SubCategoryName != "Filters" {
		t.Errorf("expected sub-category name Filters, got %q", dto.SubCategoryName)
	}
}

func TestSubSubCategoryDelete_PassesIDAndError(t *testing.T) {
	repo := newMockSubSubCategoryRepo()
	wantErr := errors.New("has products")
	repo.deleteFn = func(uint) error { return wantErr }
	svc := wmsService.NewSubSubCategoryService(repo)
	if err := svc.Delete(1); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
