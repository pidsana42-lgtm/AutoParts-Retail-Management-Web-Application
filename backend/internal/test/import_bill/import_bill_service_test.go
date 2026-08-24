package importbill

import (
	"errors"
	"testing"
	"time"

	"backend/internal/app/entity"
	importDataDTO "backend/internal/app/dto/import_data"
	billRepo "backend/internal/app/repository/import_data"
	billService "backend/internal/app/service/import_data"

	"gorm.io/gorm"
)

// -----------------------------------------------------------------------------
// Mock Repository
// -----------------------------------------------------------------------------

type mockImportBillRepo struct {
	createBillFn             func(*entity.Bill) error
	listBillsFn              func() ([]entity.Bill, error)
	createBillImageFn        func(*entity.BillImage) error
	createJobFn              func(*entity.BillImportJob) error
	getJobByIDFn             func(id uint) (*entity.BillImportJob, error)
	saveJobFn                func(*entity.BillImportJob) error
	createItemFn             func(*entity.BillItem) error
	confirmTxnFn             func(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob, role string) error
	getBillByIDFn            func(id uint) (*entity.Bill, error)
	updateBillFn             func(id uint, bill *entity.Bill, items []entity.BillItem) error
	deleteBillFn             func(id uint) error
	findOrCreateSupplierFn   func(name string) (uint, error)
	listPOsFn                func() ([]entity.PO, error)
	getPOByIDFn              func(id uint) (*entity.PO, error)
	updateProductFn          func(id uint, product *entity.Product, modelIDs []uint) error

	called map[string]int
}

func newMockRepo() *mockImportBillRepo {
	return &mockImportBillRepo{called: map[string]int{}}
}

func (m *mockImportBillRepo) track(name string) { m.called[name]++ }

func (m *mockImportBillRepo) CreateBill(b *entity.Bill) error {
	m.track("CreateBill")
	if m.createBillFn != nil {
		return m.createBillFn(b)
	}
	b.ID = 1
	return nil
}

func (m *mockImportBillRepo) ListBills() ([]entity.Bill, error) {
	m.track("ListBills")
	if m.listBillsFn != nil {
		return m.listBillsFn()
	}
	return nil, nil
}

func (m *mockImportBillRepo) CreateBillImage(img *entity.BillImage) error {
	m.track("CreateBillImage")
	if m.createBillImageFn != nil {
		return m.createBillImageFn(img)
	}
	img.ID = 1
	return nil
}

func (m *mockImportBillRepo) CreateBillImportJob(job *entity.BillImportJob) error {
	m.track("CreateBillImportJob")
	if m.createJobFn != nil {
		return m.createJobFn(job)
	}
	job.ID = 55
	return nil
}

func (m *mockImportBillRepo) GetBillImportJobByID(id uint) (*entity.BillImportJob, error) {
	m.track("GetBillImportJobByID")
	if m.getJobByIDFn != nil {
		return m.getJobByIDFn(id)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockImportBillRepo) SaveBillImportJob(job *entity.BillImportJob) error {
	m.track("SaveBillImportJob")
	if m.saveJobFn != nil {
		return m.saveJobFn(job)
	}
	return nil
}

func (m *mockImportBillRepo) CreateBillItem(item *entity.BillItem) error {
	m.track("CreateBillItem")
	if m.createItemFn != nil {
		return m.createItemFn(item)
	}
	item.ID = 1
	return nil
}

func (m *mockImportBillRepo) ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob, role string) error {
	m.track("ConfirmBillImportTransaction")
	if m.confirmTxnFn != nil {
		return m.confirmTxnFn(bill, items, job, role)
	}
	bill.ID = 77
	return nil
}

func (m *mockImportBillRepo) GetBillByID(id uint) (*entity.Bill, error) {
	m.track("GetBillByID")
	if m.getBillByIDFn != nil {
		return m.getBillByIDFn(id)
	}
	return &entity.Bill{}, nil
}

func (m *mockImportBillRepo) UpdateBill(id uint, bill *entity.Bill, items []entity.BillItem) error {
	m.track("UpdateBill")
	if m.updateBillFn != nil {
		return m.updateBillFn(id, bill, items)
	}
	return nil
}

func (m *mockImportBillRepo) DeleteBill(id uint) error {
	m.track("DeleteBill")
	if m.deleteBillFn != nil {
		return m.deleteBillFn(id)
	}
	return nil
}

func (m *mockImportBillRepo) FindOrCreateSupplierByName(name string) (uint, error) {
	m.track("FindOrCreateSupplierByName")
	if m.findOrCreateSupplierFn != nil {
		return m.findOrCreateSupplierFn(name)
	}
	return 1, nil
}

func (m *mockImportBillRepo) ListPurchaseOrders() ([]entity.PO, error) {
	m.track("ListPurchaseOrders")
	if m.listPOsFn != nil {
		return m.listPOsFn()
	}
	return nil, nil
}

func (m *mockImportBillRepo) GetPurchaseOrderByID(id uint) (*entity.PO, error) {
	m.track("GetPurchaseOrderByID")
	if m.getPOByIDFn != nil {
		return m.getPOByIDFn(id)
	}
	return &entity.PO{}, nil
}

func (m *mockImportBillRepo) UpdateImportProduct(id uint, product *entity.Product, modelIDs []uint) error {
	m.track("UpdateImportProduct")
	if m.updateProductFn != nil {
		return m.updateProductFn(id, product, modelIDs)
	}
	return nil
}

var _ billRepo.ImportBillRepository = (*mockImportBillRepo)(nil)

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

func newService(repo *mockImportBillRepo) billService.ImportBillService {
	// notification = nil ได้เพราะ service มี guard เช็ค nil ก่อนใช้
	return billService.NewImportBillService(repo, nil)
}

// errDbFail ใช้ instance เดียวกันระหว่าง stub และ expected เพื่อให้ errors.Is เทียบ identity ได้
var errDbFail = errors.New("db fail")

func sampleBillDTO() importDataDTO.CreateBillDTO {
	return importDataDTO.CreateBillDTO{
		BillNo:      "BILL-2026-001",
		TotalAmount: 5000,
		Subtotal:    4500,
		VatAmount:   315,
		GrandTotal:  4815,
		SupplierID:  3,
		PaymentStatus: "unpaid",
		DueDate:     importDataDTO.FlexTime{Time: time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC)},
		ReceiveDate: importDataDTO.FlexTime{Time: time.Date(2026, 8, 20, 0, 0, 0, 0, time.UTC)},
	}
}

func sampleItem(seq uint, productID uint) importDataDTO.CreateBillItemDTO {
	return importDataDTO.CreateBillItemDTO{
		BillID:             0,
		ItemSequence:       seq,
		CompanyProductCode: "CP-001",
		CompanyProductName: "น้ำมันเครื่อง 4L",
		OrderQuantity:      10,
		Unit:               "แถว",
		ConversionFactor:   12,
		PricePerUnit:       150,
		NetAmount:          18000,
		ProductID:          productID,
	}
}

// -----------------------------------------------------------------------------
// CreateBill / ListBills
// -----------------------------------------------------------------------------

func TestCreateBill_DefaultsVerifiedToOne(t *testing.T) {
	repo := newMockRepo()
	var captured entity.Bill
	repo.createBillFn = func(b *entity.Bill) error {
		b.ID = 11
		captured = *b
		return nil
	}

	got, err := newService(repo).CreateBill(sampleBillDTO())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.VerifiedBy != 1 {
		t.Errorf("expected VerifiedBy defaulted to 1, got %d", captured.VerifiedBy)
	}
	if got.ID != 11 || got.BillNo != "BILL-2026-001" {
		t.Errorf("response not mapped: %+v", got)
	}
}

func TestCreateBill_KeepsProvidedVerifiedBy(t *testing.T) {
	repo := newMockRepo()
	var captured entity.Bill
	repo.createBillFn = func(b *entity.Bill) error {
		captured = *b
		return nil
	}
	in := sampleBillDTO()
	in.VerifiedBy = 9
	if _, err := newService(repo).CreateBill(in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.VerifiedBy != 9 {
		t.Errorf("expected VerifiedBy 9 kept, got %d", captured.VerifiedBy)
	}
}

func TestListBills_MapsEachEntity(t *testing.T) {
	repo := newMockRepo()
	repo.listBillsFn = func() ([]entity.Bill, error) {
		return []entity.Bill{
			{Model: gorm.Model{ID: 1}, BillNo: "A", CreditTerm: "30 Days"},
			{Model: gorm.Model{ID: 2}, BillNo: "B", CreditTerm: "30 Days"},
		}, nil
	}
	got, err := newService(repo).ListBills()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 || got[0].BillNo != "A" || got[1].BillNo != "B" {
		t.Errorf("unexpected mapping result: %+v", got)
	}
}

// -----------------------------------------------------------------------------
// CreateBillImportJob
// -----------------------------------------------------------------------------

func TestCreateBillImportJob_ForcesPendingStatus(t *testing.T) {
	repo := newMockRepo()
	var captured entity.BillImportJob
	repo.createJobFn = func(j *entity.BillImportJob) error {
		j.ID = 55
		captured = *j
		return nil
	}
	// ตัดสาย OCR background: ให้ lookup หลัง spawn error ทันที (ไม่ยิง FastAPI/exec)
	repo.getJobByIDFn = func(uint) (*entity.BillImportJob, error) {
		return nil, errors.New("short circuit")
	}

	got, err := newService(repo).CreateBillImportJob(importDataDTO.CreateBillImportJobDTO{
		FileURL:   "/uploads/bill.jpg",
		FileType:  "invoice",
		Status:    "processed", // client พยายามส่งมาเอง — ต้องถูกบังคับเป็น pending
		CreatedBy: 8,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.Status != "pending" {
		t.Errorf("expected forced status pending, got %q", captured.Status)
	}
	if got.ID != 55 || got.FileURL != "/uploads/bill.jpg" {
		t.Errorf("response not mapped: %+v", got)
	}
	time.Sleep(50 * time.Millisecond) // รอ goroutine ออกจาก critical section
}

// -----------------------------------------------------------------------------
// ConfirmBillImport
// -----------------------------------------------------------------------------

func TestConfirmBillImport_WithExistingJob(t *testing.T) {
	repo := newMockRepo()
	existing := &entity.BillImportJob{
		Model:    gorm.Model{ID: 5},
		FileURL:  "/uploads/bill.jpg",
		Status:   "processed",
		DraftJSON: "{}",
	}
	repo.getJobByIDFn = func(id uint) (*entity.BillImportJob, error) {
		if id == 5 {
			return existing, nil
		}
		return nil, gorm.ErrRecordNotFound
	}
	repo.findOrCreateSupplierFn = func(name string) (uint, error) {
		if name == "วายุภัณ" {
			return 88, nil
		}
		return 0, errors.New("not found")
	}

	var capBill entity.Bill
	var capItems []entity.BillItem
	var capRole string
	var capJob *entity.BillImportJob
	repo.confirmTxnFn = func(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob, role string) error {
		capBill = *bill
		capItems = items
		capRole = role
		capJob = job
		bill.ID = 77
		return nil
	}

	input := importDataDTO.ConfirmBillImportDTO{
		Bill:      sampleBillDTO(), // SupplierID=3, SupplierName="" -> ไม่ resolve, ใช้ 3
		Items:     []importDataDTO.CreateBillItemDTO{sampleItem(1, 7), sampleItem(2, 7), sampleItem(3, 9)},
		DraftJSON: `{"fixed": true}`,
	}
	got, err := newService(repo).ConfirmBillImport(5, input, "Employee")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if capBill.SupplierID != 3 {
		t.Errorf("expected supplier 3 kept when name empty, got %d", capBill.SupplierID)
	}
	if capRole != "Employee" {
		t.Errorf("expected role forwarded, got %q", capRole)
	}
	if len(capItems) != 3 || capItems[2].ProductID != 9 {
		t.Errorf("items not mapped: %+v", capItems)
	}
	if capJob == nil || capJob.Status != "confirmed" {
		t.Fatalf("expected job confirmed, got %+v", capJob)
	}
	if capJob.ConfirmedAt == nil {
		t.Error("expected ConfirmedAt stamped")
	}
	if capJob.ConfirmedBillID == nil || *capJob.ConfirmedBillID != 77 {
		t.Errorf("expected ConfirmedBillID linked to new bill ID 77, got %v", capJob.ConfirmedBillID)
	}
	if capJob.DraftJSON != `{"fixed": true}` {
		t.Errorf("expected DraftJSON overwritten, got %q", capJob.DraftJSON)
	}
	if got.Job.ID != 5 || got.Bill.ID != 77 || len(got.Items) != 3 {
		t.Errorf("response shape wrong: job=%d bill=%d items=%d", got.Job.ID, got.Bill.ID, len(got.Items))
	}
}

func TestConfirmBillImport_SupplierNameResolutionOverridesID(t *testing.T) {
	repo := newMockRepo()
	repo.getJobByIDFn = func(uint) (*entity.BillImportJob, error) { return nil, gorm.ErrRecordNotFound }
	repo.findOrCreateSupplierFn = func(string) (uint, error) { return 88, nil }

	var capSupplierID uint
	repo.confirmTxnFn = func(bill *entity.Bill, _ []entity.BillItem, _ *entity.BillImportJob, _ string) error {
		capSupplierID = bill.SupplierID
		bill.ID = 1
		return nil
	}

	in := sampleBillDTO() // SupplierID = 3
	in.SupplierName = "วายุภัณ"
	if _, err := newService(repo).ConfirmBillImport(0, importDataDTO.ConfirmBillImportDTO{Bill: in}, "Owner"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capSupplierID != 88 {
		t.Errorf("expected resolved supplier 88 override DTO id 3, got %d", capSupplierID)
	}
}

func TestConfirmBillImport_ManualEntry_CreatesPlaceholderJobWithDefaults(t *testing.T) {
	repo := newMockRepo()
	var createdJobs []*entity.BillImportJob
	repo.createJobFn = func(j *entity.BillImportJob) error {
		j.ID = 100 + uint(len(createdJobs)) //nolint:gosec // test data
		cp := *j
		createdJobs = append(createdJobs, &cp)
		return nil
	}

	var capBill entity.Bill
	repo.confirmTxnFn = func(bill *entity.Bill, _ []entity.BillItem, _ *entity.BillImportJob, _ string) error {
		capBill = *bill
		bill.ID = 200
		return nil
	}

	in := sampleBillDTO()
	in.VerifiedBy = 0
	in.SupplierID = 0 // SupplierName ว่าง + ID 0 -> default 1
	in.DueDate = importDataDTO.FlexTime{}
	in.ReceiveDate = importDataDTO.FlexTime{}

	if _, err := newService(repo).ConfirmBillImport(0, importDataDTO.ConfirmBillImportDTO{Bill: in}, "Owner"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(createdJobs) != 1 {
		t.Fatalf("expected placeholder job created, got %d", len(createdJobs))
	}
	j := createdJobs[0]
	if j.FileURL != "manual_entry" || j.FileType != "invoice" || j.Status != "pending" {
		t.Errorf("placeholder job fields wrong: %+v", j)
	}
	if j.CreatedBy != 1 {
		t.Errorf("expected CreatedBy defaulted to 1, got %d", j.CreatedBy)
	}
	if capBill.SupplierID != 1 {
		t.Errorf("expected supplier defaulted to 1, got %d", capBill.SupplierID)
	}
	if capBill.VerifiedBy != 1 {
		t.Errorf("expected VerifiedBy defaulted to 1, got %d", capBill.VerifiedBy)
	}
}

// -----------------------------------------------------------------------------
// UpdateBill
// -----------------------------------------------------------------------------

func TestUpdateBill_StampsPathIDOntoBillAndItems(t *testing.T) {
	repo := newMockRepo()
	repo.findOrCreateSupplierFn = func(name string) (uint, error) {
		if name == "ซัพพลายเออร์ใหม่" {
			return 66, nil
		}
		return 0, errors.New("not found")
	}
	var capID uint
	var capBill entity.Bill
	var capItems []entity.BillItem
	repo.updateBillFn = func(id uint, b *entity.Bill, items []entity.BillItem) error {
		capID = id
		capBill = *b
		capItems = items
		return nil
	}

	in := sampleBillDTO()
	in.SupplierName = "ซัพพลายเออร์ใหม่"
	items := []importDataDTO.CreateBillItemDTO{sampleItem(1, 0)}

	got, err := newService(repo).UpdateBill(42, importDataDTO.ConfirmBillImportDTO{
		Bill:  in,
		Items: items,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capID != 42 || capBill.ID != 42 {
		t.Errorf("expected path id 42 used, got path=%d entity=%d", capID, capBill.ID)
	}
	if capBill.SupplierID != 66 {
		t.Errorf("expected resolved supplier 66, got %d", capBill.SupplierID)
	}
	for i, it := range capItems {
		if it.BillID != 42 {
			t.Errorf("item[%d].BillID expected 42, got %d", i, it.BillID)
		}
	}
	if got.ID != 42 {
		t.Errorf("response should reflect updated id 42, got %d", got.ID)
	}
}

// -----------------------------------------------------------------------------
// DeleteBill — กติกาสิทธิ์การลบ
// -----------------------------------------------------------------------------

func TestDeleteBill_RoleRules(t *testing.T) {
	approvedBill := func() *entity.Bill {
		return &entity.Bill{Model: gorm.Model{ID: 9}, PaymentStatus: "approved", IsVerified: true}
	}

	tests := []struct {
		name           string
		role           string
		billInDB       func() *entity.Bill
		fetchErr       error
		wantErr        error
		wantDeleteCall bool
		wantFetchCall  bool
	}{
		{
			name:           "owner deletes without permission check",
			role:           "Owner",
			wantDeleteCall: true,
		},
		{
			name:           "admin (case-insensitive) skips check",
			role:           "aDmIn",
			wantDeleteCall: true,
		},
		{
			name:           "employee can delete unapproved bill",
			role:           "Employee",
			billInDB:       func() *entity.Bill { return &entity.Bill{Model: gorm.Model{ID: 9}} },
			wantFetchCall:  true,
			wantDeleteCall: true,
		},
		{
			name:     "employee cannot delete verified bill",
			role:     "Employee",
			billInDB: approvedBill,
			wantErr:  billService.ErrBillDeleteForbidden,
			wantFetchCall: true,
		},
		{
			name: "employee cannot delete approved-payment bill (case-insensitive)",
			role: "employee",
			billInDB: func() *entity.Bill {
				return &entity.Bill{Model: gorm.Model{ID: 9}, PaymentStatus: "APPROVED"}
			},
			wantErr:       billService.ErrBillDeleteForbidden,
			wantFetchCall: true,
		},
		{
			name:     "fetch error returned as-is",
			role:     "Employee",
			fetchErr: errDbFail,
			wantErr:  errDbFail,
			wantFetchCall: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMockRepo()
			repo.getBillByIDFn = func(uint) (*entity.Bill, error) {
				if tt.fetchErr != nil {
					return nil, tt.fetchErr
				}
				if tt.billInDB != nil {
					return tt.billInDB(), nil
				}
				return &entity.Bill{}, nil
			}

			err := newService(repo).DeleteBill(9, tt.role)

			if tt.wantErr != nil && !errors.Is(err, tt.wantErr) {
				t.Fatalf("expected error %v, got %v", tt.wantErr, err)
			}
			if tt.wantErr == nil && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got := repo.called["DeleteBill"] > 0; got != tt.wantDeleteCall {
				t.Errorf("DeleteBill called = %v, want %v", got, tt.wantDeleteCall)
			}
			if got := repo.called["GetBillByID"] > 0; got != tt.wantFetchCall {
				t.Errorf("GetBillByID called = %v, want %v", got, tt.wantFetchCall)
			}
		})
	}
}

// -----------------------------------------------------------------------------
// UpdateProduct / PO passthrough
// -----------------------------------------------------------------------------

func TestUpdateProduct_MapsAllFields(t *testing.T) {
	repo := newMockRepo()
	var capID uint
	var capProd entity.Product
	var capModels []uint
	repo.updateProductFn = func(id uint, p *entity.Product, modelIDs []uint) error {
		capID = id
		capProd = *p
		capModels = modelIDs
		return nil
	}

	in := importDataDTO.UpdateImportProductDTO{
		ProductCode:   "SPK-100",
		PartNumber:    "90915-10003",
		ProductName:   "ไส้กรองน้ำมัน",
		Barcode:       "885000000001",
		Quantity:      25,
		LimitQuantity: 5,
		CostPrice:     90,
		SalePrice:     150,
		Note:          "ของแท้",
		ModelIDs:      []uint{1, 2, 3},
		CategoryID:    4,
		GradeID:       5,
		UnitID:        6,
		ShelfID:       7,
	}
	if err := newService(repo).UpdateProduct(33, in); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if capID != 33 {
		t.Errorf("expected id 33, got %d", capID)
	}
	if capProd.Product_Code != "SPK-100" || capProd.Part_Number != "90915-10003" || capProd.Product_Name != "ไส้กรองน้ำมัน" {
		t.Errorf("identity fields not mapped: %+v", capProd)
	}
	if capProd.Quantity != 25 || capProd.Limit_Quantity != 5 || capProd.Cost_price != 90 || capProd.Sale_price != 150 {
		t.Errorf("numeric fields not mapped: %+v", capProd)
	}
	if !reflectDeepEqual(capModels, []uint{1, 2, 3}) {
		t.Errorf("model ids not forwarded: %v", capModels)
	}
}

func reflectDeepEqual(a, b []uint) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestGetPurchaseOrderByID_ErrorPassthrough(t *testing.T) {
	repo := newMockRepo()
	wantErr := gorm.ErrRecordNotFound
	repo.getPOByIDFn = func(uint) (*entity.PO, error) { return nil, wantErr }
	if _, err := newService(repo).GetPurchaseOrderByID(999); !errors.Is(err, wantErr) {
		t.Fatalf("expected %v, got %v", wantErr, err)
	}
}
