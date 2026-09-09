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

// ---------------------------------------------------------------------------
// mockProductRepo: fake ที่ implement wmsRepo.ProductRepository เอง ไม่พึ่งไลบรารี mock
// ใดๆ — แต่ละ test ตั้งค่าเฉพาะ ...Fn ที่ตัวเองสนใจ ที่เหลือปล่อยให้ default พฤติกรรมทำงานไป
// ---------------------------------------------------------------------------

type mockProductRepo struct {
	createProductFn           func(*entity.Product) error
	getProductByIDFn          func(uint) (*entity.Product, error)
	updateProductFn           func(*entity.Product) error
	deleteProductFn           func(uint) error
	createProductImageFn      func(*entity.ProductImage) error
	listProductsFn            func() ([]entity.Product, error)
	listBrandsFn              func() ([]entity.Brand, error)
	createBrandFn             func(*entity.Brand) error
	updateBrandFn             func(*entity.Brand) error
	deleteBrandFn             func(uint) error
	createModelFn             func(*entity.Models) error
	updateModelFn             func(*entity.Models) error
	deleteModelFn             func(uint) error
	replaceProductSuppliersFn func(uint, []entity.Inventory) error
	receiveStockFn            func(uint, int, []entity.Inventory) error
	listDeletedProductsFn     func() ([]entity.Product, error)
	restoreProductFn          func(uint) error

	called map[string]int
}

func newMockProductRepo() *mockProductRepo {
	return &mockProductRepo{called: map[string]int{}}
}

func (m *mockProductRepo) track(name string) { m.called[name]++ }

func (m *mockProductRepo) CreateProduct(product *entity.Product) error {
	m.track("CreateProduct")
	if m.createProductFn != nil {
		return m.createProductFn(product)
	}
	product.ID = 1
	return nil
}

func (m *mockProductRepo) GetProductByID(id uint) (*entity.Product, error) {
	m.track("GetProductByID")
	if m.getProductByIDFn != nil {
		return m.getProductByIDFn(id)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockProductRepo) UpdateProduct(product *entity.Product) error {
	m.track("UpdateProduct")
	if m.updateProductFn != nil {
		return m.updateProductFn(product)
	}
	return nil
}

func (m *mockProductRepo) DeleteProduct(id uint) error {
	m.track("DeleteProduct")
	if m.deleteProductFn != nil {
		return m.deleteProductFn(id)
	}
	return nil
}

func (m *mockProductRepo) CreateProductImage(image *entity.ProductImage) error {
	m.track("CreateProductImage")
	if m.createProductImageFn != nil {
		return m.createProductImageFn(image)
	}
	image.ID = 1
	return nil
}

func (m *mockProductRepo) ListProducts() ([]entity.Product, error) {
	m.track("ListProducts")
	if m.listProductsFn != nil {
		return m.listProductsFn()
	}
	return nil, nil
}

func (m *mockProductRepo) ListBrands() ([]entity.Brand, error) {
	m.track("ListBrands")
	if m.listBrandsFn != nil {
		return m.listBrandsFn()
	}
	return nil, nil
}

func (m *mockProductRepo) CreateBrand(brand *entity.Brand) error {
	m.track("CreateBrand")
	if m.createBrandFn != nil {
		return m.createBrandFn(brand)
	}
	brand.ID = 1
	return nil
}

func (m *mockProductRepo) UpdateBrand(brand *entity.Brand) error {
	m.track("UpdateBrand")
	if m.updateBrandFn != nil {
		return m.updateBrandFn(brand)
	}
	return nil
}

func (m *mockProductRepo) DeleteBrand(id uint) error {
	m.track("DeleteBrand")
	if m.deleteBrandFn != nil {
		return m.deleteBrandFn(id)
	}
	return nil
}

func (m *mockProductRepo) CreateModel(model *entity.Models) error {
	m.track("CreateModel")
	if m.createModelFn != nil {
		return m.createModelFn(model)
	}
	model.ID = 1
	return nil
}

func (m *mockProductRepo) UpdateModel(model *entity.Models) error {
	m.track("UpdateModel")
	if m.updateModelFn != nil {
		return m.updateModelFn(model)
	}
	return nil
}

func (m *mockProductRepo) DeleteModel(id uint) error {
	m.track("DeleteModel")
	if m.deleteModelFn != nil {
		return m.deleteModelFn(id)
	}
	return nil
}

func (m *mockProductRepo) ReplaceProductSuppliers(productID uint, inventories []entity.Inventory) error {
	m.track("ReplaceProductSuppliers")
	if m.replaceProductSuppliersFn != nil {
		return m.replaceProductSuppliersFn(productID, inventories)
	}
	return nil
}

func (m *mockProductRepo) ReceiveStock(productID uint, addedQty int, suppliers []entity.Inventory) error {
	m.track("ReceiveStock")
	if m.receiveStockFn != nil {
		return m.receiveStockFn(productID, addedQty, suppliers)
	}
	return nil
}

func (m *mockProductRepo) ListDeletedProducts() ([]entity.Product, error) {
	m.track("ListDeletedProducts")
	if m.listDeletedProductsFn != nil {
		return m.listDeletedProductsFn()
	}
	return nil, nil
}

func (m *mockProductRepo) RestoreProduct(id uint) error {
	m.track("RestoreProduct")
	if m.restoreProductFn != nil {
		return m.restoreProductFn(id)
	}
	return nil
}

var _ wmsRepo.ProductRepository = (*mockProductRepo)(nil)

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

// validProductRequest: request ที่ผ่านทุกเงื่อนไข validation ขั้นต่ำ ไว้เป็นฐานให้ test แต่ละอันไป override เฉพาะจุดที่สนใจ
func validProductRequest() *wmsDTO.ProductRequestDTO {
	return &wmsDTO.ProductRequestDTO{
		Product_Code: "OIL-001",
		Part_Number:  "PN-1",
		Product_Name: "Synthetic Oil",
		Quantity:     10,
		Sale_price:   100,
		Cost_price:   50,
		ModelIDs:     []uint{1},
		UnitID:       1,
		CategoryID:   1,
		GradeID:      1,
		ShelfID:      1,
		Suppliers: []wmsDTO.ProductSupplierInput{
			{SupplierID: 5, Quantity: 10},
		},
	}
}

// productWithSupplier: entity.Product ที่มี Inventory + Supplier ผูกอยู่ 1 เจ้า ไว้ใช้เป็นค่าตอบกลับของ
// GetProductByID ในหลายเทสต์ที่ต้องอ่าน Inventories[0].Supplier ต่อ (เช่น ReceiveStock)
func productWithSupplier(id uint, supplierShortName string) *entity.Product {
	return &entity.Product{
		Model:        gorm.Model{ID: id},
		Product_Code: "OIL-001",
		Product_Name: "Synthetic Oil",
		Part_Number:  "PN-1",
		Unit:         &entity.Unit{Unit_Name: "ขวด"},
		Inventories: []entity.Inventory{
			{
				SupplierID: 5,
				Supplier:   &entity.Supplier{ShortSupplierName: supplierShortName},
			},
		},
	}
}

// ---------------------------------------------------------------------------
// CreateProduct
// ---------------------------------------------------------------------------

func TestCreateProduct_Success(t *testing.T) {
	repo := newMockProductRepo()

	var createdProduct entity.Product
	repo.createProductFn = func(p *entity.Product) error {
		p.ID = 10
		createdProduct = *p
		return nil
	}

	var repliedProductID uint
	var repliedInventories []entity.Inventory
	repo.replaceProductSuppliersFn = func(productID uint, inventories []entity.Inventory) error {
		repliedProductID = productID
		repliedInventories = inventories
		return nil
	}

	repo.getProductByIDFn = func(id uint) (*entity.Product, error) {
		return productWithSupplier(id, "TAP"), nil
	}

	svc := wmsService.NewProductService(repo)
	result, err := svc.CreateProduct(validProductRequest())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if createdProduct.Product_Name != "Synthetic Oil" {
		t.Errorf("expected repo.CreateProduct to receive mapped entity, got %+v", createdProduct)
	}
	if repliedProductID != 10 {
		t.Errorf("expected ReplaceProductSuppliers called with product ID 10, got %d", repliedProductID)
	}
	if len(repliedInventories) != 1 || repliedInventories[0].SupplierID != 5 || repliedInventories[0].Inventory_Quantity != 10 {
		t.Errorf("expected inventories built from suppliers input, got %+v", repliedInventories)
	}

	// ผลลัพธ์ที่คืนกลับมาจากการ fetch ซ้ำผ่าน GetProductByID (mock คืน mock ล่าสุด)
	if result.Product_Code != "OIL-001" {
		t.Errorf("expected product_code OIL-001 in response, got %s", result.Product_Code)
	}
	if repo.called["CreateProduct"] != 1 {
		t.Errorf("expected CreateProduct called exactly once, got %d", repo.called["CreateProduct"])
	}
}

func TestCreateProduct_SupplierQuantityExceedsTotal_ReturnsErrorWithoutTouchingRepo(t *testing.T) {
	repo := newMockProductRepo()
	svc := wmsService.NewProductService(repo)

	req := validProductRequest()
	req.Quantity = 5
	req.Suppliers = []wmsDTO.ProductSupplierInput{
		{SupplierID: 1, Quantity: 3},
		{SupplierID: 2, Quantity: 3}, // รวม 6 > 5
	}

	_, err := svc.CreateProduct(req)
	if err == nil {
		t.Fatal("expected error when supplier quantities exceed total quantity")
	}
	if repo.called["CreateProduct"] != 0 {
		t.Errorf("expected CreateProduct not to be called when validation fails, got %d calls", repo.called["CreateProduct"])
	}
}

func TestCreateProduct_RepoCreateError_PropagatesAndSkipsFollowUpCalls(t *testing.T) {
	repo := newMockProductRepo()
	wantErr := errors.New("db insert failed")
	repo.createProductFn = func(*entity.Product) error { return wantErr }

	svc := wmsService.NewProductService(repo)
	_, err := svc.CreateProduct(validProductRequest())
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
	if repo.called["ReplaceProductSuppliers"] != 0 {
		t.Error("expected ReplaceProductSuppliers not to be called when CreateProduct fails")
	}
}

func TestCreateProduct_NoSupplierLinked_Success(t *testing.T) {
	// สร้างสินค้าได้ปกติแม้ไม่มี Supplier ผูกมาด้วยเลย (Suppliers เป็น nil) — ต้องไม่ error
	repo := newMockProductRepo()
	repo.createProductFn = func(p *entity.Product) error {
		p.ID = 30
		return nil
	}
	repo.getProductByIDFn = func(id uint) (*entity.Product, error) {
		return &entity.Product{
			Model:        gorm.Model{ID: id},
			Product_Code: "OIL-001",
			Product_Name: "Synthetic Oil",
			Unit:         &entity.Unit{Unit_Name: "ขวด"},
			// Inventories ว่างเปล่า
		}, nil
	}

	req := validProductRequest()
	req.Suppliers = nil

	svc := wmsService.NewProductService(repo)
	result, err := svc.CreateProduct(req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Product_Code != "OIL-001" {
		t.Errorf("expected product_code OIL-001 in response, got %s", result.Product_Code)
	}
}

// ---------------------------------------------------------------------------
// UpdateProduct
// ---------------------------------------------------------------------------

func TestUpdateProduct_Success(t *testing.T) {
	repo := newMockProductRepo()

	var updatedProduct entity.Product
	repo.updateProductFn = func(p *entity.Product) error {
		updatedProduct = *p
		return nil
	}
	repo.getProductByIDFn = func(id uint) (*entity.Product, error) {
		return productWithSupplier(id, "TAP"), nil
	}

	svc := wmsService.NewProductService(repo)
	err := svc.UpdateProduct(42, validProductRequest())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updatedProduct.ID != 42 {
		t.Errorf("expected updated entity ID 42, got %d", updatedProduct.ID)
	}
	if updatedProduct.Product_Name != "Synthetic Oil" {
		t.Errorf("expected repo.UpdateProduct to receive mapped entity, got %+v", updatedProduct)
	}
}

func TestUpdateProduct_SupplierQuantityExceedsTotal_DoesNotCallRepo(t *testing.T) {
	repo := newMockProductRepo()
	svc := wmsService.NewProductService(repo)

	req := validProductRequest()
	req.Quantity = 1
	req.Suppliers = []wmsDTO.ProductSupplierInput{{SupplierID: 1, Quantity: 2}}

	if err := svc.UpdateProduct(1, req); err == nil {
		t.Fatal("expected error when supplier quantities exceed total quantity")
	}
	if repo.called["UpdateProduct"] != 0 {
		t.Errorf("expected UpdateProduct not to be called when validation fails, got %d calls", repo.called["UpdateProduct"])
	}
}

func TestUpdateProduct_RepoError_Propagates(t *testing.T) {
	repo := newMockProductRepo()
	wantErr := errors.New("update failed")
	repo.updateProductFn = func(*entity.Product) error { return wantErr }

	svc := wmsService.NewProductService(repo)
	err := svc.UpdateProduct(1, validProductRequest())
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
	if repo.called["ReplaceProductSuppliers"] != 0 {
		t.Error("expected ReplaceProductSuppliers not to be called when UpdateProduct fails")
	}
}

// ---------------------------------------------------------------------------
// GetProductByID / ListProducts / ListDeletedProducts — เน้นเคส Unit เป็น nil
// (regression: FromEntity เดิม dereference p.Unit.Unit_Name ตรงๆ ไม่เช็ค nil ก่อน ทำให้ panic ถ้าสินค้าไม่มี Unit)
// ---------------------------------------------------------------------------

func TestGetProductByID_NilUnit_DoesNotPanicAndLeavesUnitNameEmpty(t *testing.T) {
	repo := newMockProductRepo()
	repo.getProductByIDFn = func(id uint) (*entity.Product, error) {
		return &entity.Product{
			Model:        gorm.Model{ID: id},
			Product_Code: "NO-UNIT",
			Unit:         nil,
		}, nil
	}

	svc := wmsService.NewProductService(repo)
	result, err := svc.GetProductByID(1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.UnitName != "" {
		t.Errorf("expected empty UnitName when product has no unit, got %q", result.UnitName)
	}
}

func TestGetProductByID_NotFound_ReturnsRepoError(t *testing.T) {
	repo := newMockProductRepo()
	svc := wmsService.NewProductService(repo)

	_, err := svc.GetProductByID(999)
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected gorm.ErrRecordNotFound, got %v", err)
	}
}

func TestListProducts_MapsAllEntitiesToDTOs(t *testing.T) {
	repo := newMockProductRepo()
	repo.listProductsFn = func() ([]entity.Product, error) {
		return []entity.Product{
			{Model: gorm.Model{ID: 1}, Product_Code: "A", Unit: &entity.Unit{Unit_Name: "ชิ้น"}},
			{Model: gorm.Model{ID: 2}, Product_Code: "B", Unit: nil},
		}, nil
	}

	svc := wmsService.NewProductService(repo)
	result, err := svc.ListProducts()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 2 {
		t.Fatalf("expected 2 products, got %d", len(result))
	}
	if result[0].Product_Code != "A" || result[1].Product_Code != "B" {
		t.Errorf("expected products in original order, got %+v", result)
	}
}

func TestListDeletedProducts_MapsAllEntitiesToDTOs(t *testing.T) {
	repo := newMockProductRepo()
	repo.listDeletedProductsFn = func() ([]entity.Product, error) {
		return []entity.Product{{Model: gorm.Model{ID: 1}, Product_Code: "DELETED-1"}}, nil
	}

	svc := wmsService.NewProductService(repo)
	result, err := svc.ListDeletedProducts()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result) != 1 || result[0].Product_Code != "DELETED-1" {
		t.Errorf("unexpected result: %+v", result)
	}
}

// ---------------------------------------------------------------------------
// DeleteProduct / RestoreProduct — passthrough แบบง่าย (สำเร็จ + error ก็ต้องส่งต่อ)
// ---------------------------------------------------------------------------

func TestDeleteProduct_PassesIDAndError(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockProductRepo()
		var gotID uint
		repo.deleteProductFn = func(id uint) error {
			gotID = id
			return nil
		}
		svc := wmsService.NewProductService(repo)
		if err := svc.DeleteProduct(7); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotID != 7 {
			t.Errorf("expected DeleteProduct called with id 7, got %d", gotID)
		}
	})

	t.Run("error passthrough", func(t *testing.T) {
		repo := newMockProductRepo()
		wantErr := errors.New("fk constraint")
		repo.deleteProductFn = func(uint) error { return wantErr }
		svc := wmsService.NewProductService(repo)
		if err := svc.DeleteProduct(7); !errors.Is(err, wantErr) {
			t.Fatalf("expected error %v, got %v", wantErr, err)
		}
	})
}

func TestRestoreProduct_PassesIDAndError(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockProductRepo()
		var gotID uint
		repo.restoreProductFn = func(id uint) error {
			gotID = id
			return nil
		}
		svc := wmsService.NewProductService(repo)
		if err := svc.RestoreProduct(9); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotID != 9 {
			t.Errorf("expected RestoreProduct called with id 9, got %d", gotID)
		}
	})

	t.Run("error passthrough", func(t *testing.T) {
		repo := newMockProductRepo()
		wantErr := gorm.ErrRecordNotFound
		repo.restoreProductFn = func(uint) error { return wantErr }
		svc := wmsService.NewProductService(repo)
		if err := svc.RestoreProduct(9); !errors.Is(err, wantErr) {
			t.Fatalf("expected error %v, got %v", wantErr, err)
		}
	})
}

// ---------------------------------------------------------------------------
// ReceiveStock
// ---------------------------------------------------------------------------

func TestReceiveStock_Success(t *testing.T) {
	repo := newMockProductRepo()

	var gotID uint
	var gotQty int
	var gotSuppliers []entity.Inventory
	repo.receiveStockFn = func(id uint, addedQty int, suppliers []entity.Inventory) error {
		gotID = id
		gotQty = addedQty
		gotSuppliers = suppliers
		return nil
	}
	repo.getProductByIDFn = func(id uint) (*entity.Product, error) {
		return productWithSupplier(id, "TAP"), nil
	}

	svc := wmsService.NewProductService(repo)
	req := &wmsDTO.ReceiveStockRequestDTO{
		Quantity: 20,
		Suppliers: []wmsDTO.ProductSupplierInput{
			{SupplierID: 5, Quantity: 20},
		},
	}
	result, err := svc.ReceiveStock(3, req)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotID != 3 || gotQty != 20 {
		t.Errorf("expected ReceiveStock called with id=3 qty=20, got id=%d qty=%d", gotID, gotQty)
	}
	if len(gotSuppliers) != 1 || gotSuppliers[0].SupplierID != 5 {
		t.Errorf("expected inventories built from suppliers input, got %+v", gotSuppliers)
	}
	if result == nil {
		t.Fatal("expected non-nil response DTO after receiving stock")
	}
}

func TestReceiveStock_SupplierQuantityExceedsAdded_ReturnsErrorWithoutTouchingRepo(t *testing.T) {
	repo := newMockProductRepo()
	svc := wmsService.NewProductService(repo)

	req := &wmsDTO.ReceiveStockRequestDTO{
		Quantity:  5,
		Suppliers: []wmsDTO.ProductSupplierInput{{SupplierID: 1, Quantity: 6}},
	}
	if _, err := svc.ReceiveStock(1, req); err == nil {
		t.Fatal("expected error when supplier quantities exceed the received quantity")
	}
	if repo.called["ReceiveStock"] != 0 {
		t.Errorf("expected ReceiveStock not to be called when validation fails, got %d calls", repo.called["ReceiveStock"])
	}
}

// ---------------------------------------------------------------------------
// Brand / Model CRUD — บาง service method เป็นแค่ mapping DTO -> entity ตรงๆ ทดสอบว่า map ถูกฟิลด์ + ส่ง error ต่อ
// ---------------------------------------------------------------------------

func TestCreateBrand_MapsNameAndReturnsCreatedEntity(t *testing.T) {
	repo := newMockProductRepo()
	repo.createBrandFn = func(b *entity.Brand) error {
		b.ID = 4
		return nil
	}
	svc := wmsService.NewProductService(repo)

	brand, err := svc.CreateBrand(&wmsDTO.BrandRequestDTO{BrandName: "Toyota"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if brand.ID != 4 || brand.Brand_Name != "Toyota" {
		t.Errorf("unexpected brand: %+v", brand)
	}
}

func TestUpdateBrand_MapsIDAndName(t *testing.T) {
	repo := newMockProductRepo()
	var got entity.Brand
	repo.updateBrandFn = func(b *entity.Brand) error {
		got = *b
		return nil
	}
	svc := wmsService.NewProductService(repo)

	if err := svc.UpdateBrand(4, &wmsDTO.BrandRequestDTO{BrandName: "Toyota"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != 4 || got.Brand_Name != "Toyota" {
		t.Errorf("unexpected entity passed to repo: %+v", got)
	}
}

func TestDeleteBrand_PassesIDAndError(t *testing.T) {
	repo := newMockProductRepo()
	wantErr := errors.New("brand in use")
	repo.deleteBrandFn = func(uint) error { return wantErr }
	svc := wmsService.NewProductService(repo)

	if err := svc.DeleteBrand(4); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

func TestCreateModel_MapsNameAndBrandID(t *testing.T) {
	repo := newMockProductRepo()
	var got entity.Models
	repo.createModelFn = func(m *entity.Models) error {
		m.ID = 8
		got = *m
		return nil
	}
	svc := wmsService.NewProductService(repo)

	model, err := svc.CreateModel(&wmsDTO.ModelRequestDTO{ModelName: "Corolla", BrandID: 4})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if model.ID != 8 || got.Model_Name != "Corolla" || got.BrandID != 4 {
		t.Errorf("unexpected model: got=%+v returned=%+v", got, model)
	}
}

func TestUpdateModel_MapsIDNameAndBrandID(t *testing.T) {
	repo := newMockProductRepo()
	var got entity.Models
	repo.updateModelFn = func(m *entity.Models) error {
		got = *m
		return nil
	}
	svc := wmsService.NewProductService(repo)

	if err := svc.UpdateModel(8, &wmsDTO.ModelRequestDTO{ModelName: "Corolla Cross", BrandID: 4}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ID != 8 || got.Model_Name != "Corolla Cross" || got.BrandID != 4 {
		t.Errorf("unexpected entity passed to repo: %+v", got)
	}
}

func TestDeleteModel_PassesIDAndError(t *testing.T) {
	repo := newMockProductRepo()
	wantErr := errors.New("model in use")
	repo.deleteModelFn = func(uint) error { return wantErr }
	svc := wmsService.NewProductService(repo)

	if err := svc.DeleteModel(8); !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}
