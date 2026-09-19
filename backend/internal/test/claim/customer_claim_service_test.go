package claim

import (
	"errors"
	"testing"
	"time"

	"backend/internal/app/entity"
	claimDTO "backend/internal/app/dto/claim"
	dtoNotification "backend/internal/app/dto/notification"
	claimRepo "backend/internal/app/repository/claim"
	svcNotification "backend/internal/app/service/notification"
	claimService "backend/internal/app/service/claim"

	"gorm.io/gorm"
)

// -----------------------------------------------------------------------------
// Mock Repositories + Fake Notifier
// -----------------------------------------------------------------------------

type stockAdjustment struct {
	productID    uint
	delta        int
	movementType string
	note         string
}

type creditAdjustment struct {
	claimID uint
	amount  float64
}

type mockClaimRepo struct {
	createClaimFn      func(*entity.CustomerClaim) error
	createItemFn       func(*entity.CustomerClaimItem) error
	getClaimFn         func(id uint) (*entity.CustomerClaim, error)
	getItemFn          func(id uint) (*entity.CustomerClaimItem, error)
	listClaimsFn       func() ([]entity.CustomerClaim, error)
	updateClaimFn      func(*entity.CustomerClaim) error
	updateItemFn       func(*entity.CustomerClaimItem) error
	deleteClaimFn      func(id uint) error
	adjustStockFn      func(productID uint, delta int, movementType, note string) error
	reduceDebtFn       func(claimID uint, amount float64) error

	called            map[string]int
	stockAdjustments  []stockAdjustment
	creditAdjustments []creditAdjustment
}

func newMockClaimRepo() *mockClaimRepo {
	return &mockClaimRepo{called: map[string]int{}}
}

func (m *mockClaimRepo) track(n string) { m.called[n]++ }

func (m *mockClaimRepo) CreateCustomerClaim(c *entity.CustomerClaim) error {
	m.track("CreateCustomerClaim")
	if m.createClaimFn != nil {
		return m.createClaimFn(c)
	}
	c.ID = 1
	return nil
}

func (m *mockClaimRepo) CreateCustomerClaimItem(i *entity.CustomerClaimItem) error {
	m.track("CreateCustomerClaimItem")
	if m.createItemFn != nil {
		return m.createItemFn(i)
	}
	i.ID = uint(100 + m.called["CreateCustomerClaimItem"]) //nolint:gosec // test data
	return nil
}

func (m *mockClaimRepo) GetCustomerClaimByID(id uint) (*entity.CustomerClaim, error) {
	m.track("GetCustomerClaimByID")
	if m.getClaimFn != nil {
		return m.getClaimFn(id)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockClaimRepo) GetCustomerClaimItemByID(id uint) (*entity.CustomerClaimItem, error) {
	m.track("GetCustomerClaimItemByID")
	if m.getItemFn != nil {
		return m.getItemFn(id)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockClaimRepo) ListCustomerClaims() ([]entity.CustomerClaim, error) {
	m.track("ListCustomerClaims")
	if m.listClaimsFn != nil {
		return m.listClaimsFn()
	}
	return nil, nil
}

func (m *mockClaimRepo) UpdateCustomerClaim(c *entity.CustomerClaim) error {
	m.track("UpdateCustomerClaim")
	if m.updateClaimFn != nil {
		return m.updateClaimFn(c)
	}
	return nil
}

func (m *mockClaimRepo) UpdateCustomerClaimItem(i *entity.CustomerClaimItem) error {
	m.track("UpdateCustomerClaimItem")
	if m.updateItemFn != nil {
		return m.updateItemFn(i)
	}
	return nil
}

func (m *mockClaimRepo) DeleteCustomerClaim(id uint) error {
	m.track("DeleteCustomerClaim")
	if m.deleteClaimFn != nil {
		return m.deleteClaimFn(id)
	}
	return nil
}

func (m *mockClaimRepo) AdjustProductStock(productID uint, delta int, movementType, note string) error {
	m.track("AdjustProductStock")
	m.stockAdjustments = append(m.stockAdjustments, stockAdjustment{productID: productID, delta: delta, movementType: movementType, note: note})
	if m.adjustStockFn != nil {
		return m.adjustStockFn(productID, delta, movementType, note)
	}
	return nil
}

func (m *mockClaimRepo) ReduceCustomerDebtForClaim(claimID uint, amount float64) error {
	m.track("ReduceCustomerDebtForClaim")
	m.creditAdjustments = append(m.creditAdjustments, creditAdjustment{claimID: claimID, amount: amount})
	if m.reduceDebtFn != nil {
		return m.reduceDebtFn(claimID, amount)
	}
	return nil
}

func (m *mockClaimRepo) GetCompanySetting() (*entity.CompanySetting, error) {
	m.track("GetCompanySetting")
	return &entity.CompanySetting{
		CompanyName: "Test Company",
	}, nil
}

var _ claimRepo.CustomerClaimRepository = (*mockClaimRepo)(nil)

type mockSORepo struct {
	getByIDFn func(id uint) (*entity.SaleOrder, error)
}

func (m *mockSORepo) GetSaleOrderByID(id uint) (*entity.SaleOrder, error) {
	if m.getByIDFn != nil {
		return m.getByIDFn(id)
	}
	return nil, gorm.ErrRecordNotFound
}

func (m *mockSORepo) GetSaleOrderByNumber(string) (*entity.SaleOrder, error) {
	return nil, gorm.ErrRecordNotFound
}

func (m *mockSORepo) SearchSaleOrders(string) ([]entity.SaleOrder, error) {
	return nil, nil
}

var _ claimRepo.SaleOrderLookupRepository = (*mockSORepo)(nil)

type notifRecord struct {
	userID uint // 0 = broadcast ถึง owners
	typ    string
	title  string
}

type fakeNotifier struct {
	records []notifRecord
	failErr error
}

func (f *fakeNotifier) NotifyOwners(notifType, title, _, _ string, _ *uint) error {
	if f.failErr != nil {
		return f.failErr
	}
	f.records = append(f.records, notifRecord{typ: notifType, title: title})
	return nil
}

func (f *fakeNotifier) NotifyUser(userID uint, notifType, title, _, _ string, _ *uint) error {
	if f.failErr != nil {
		return f.failErr
	}
	f.records = append(f.records, notifRecord{userID: userID, typ: notifType, title: title})
	return nil
}

// เมธอดอื่น ๆ ของ NotificationService ที่ claim service ไม่ได้ใช้ — stub ว่างไว้
func (f *fakeNotifier) NotifyEmployees(notifType, title, _, _ string, _ *uint) error {
	if f.failErr != nil {
		return f.failErr
	}
	f.records = append(f.records, notifRecord{typ: notifType, title: title})
	return nil
}

func (f *fakeNotifier) ListForOwners() (*dtoNotification.NotificationListResponseDTO, error) {
	return nil, nil
}

func (f *fakeNotifier) ListForUser(uint) (*dtoNotification.NotificationListResponseDTO, error) {
	return nil, nil
}

func (f *fakeNotifier) MarkRead(uint) error { return nil }

func (f *fakeNotifier) MarkAllReadForOwners() error { return nil }

func (f *fakeNotifier) MarkAllReadForUser(uint) error { return nil }

var _ svcNotification.NotificationService = (*fakeNotifier)(nil)

func newService(repo *mockClaimRepo, soRepo *mockSORepo, notif svcNotification.NotificationService) claimService.CustomerClaimService {
	return claimService.NewCustomerClaimService(repo, soRepo, notif)
}

func claimWithItems(id uint, status string, createdBy uint, itemStatuses ...string) *entity.CustomerClaim {
	items := make([]entity.CustomerClaimItem, len(itemStatuses))
	for i, st := range itemStatuses {
		items[i] = entity.CustomerClaimItem{
			Model:           gorm.Model{ID: uint(i + 1)}, //nolint:gosec // test data
			CustomerClaimID: id,
			Status:          st,
			Qty:             1,
		}
	}
	return &entity.CustomerClaim{
		Model:     gorm.Model{ID: id},
		ClaimNo:   "CLM-SO2026-0001",
		Status:    status,
		CreatedBy: createdBy,
		Items:     items,
	}
}

// -----------------------------------------------------------------------------
// CreateCustomerClaim
// -----------------------------------------------------------------------------

func TestCreateCustomerClaim_ClaimNoFromSaleOrder(t *testing.T) {
	repo := newMockClaimRepo()
	var captured entity.CustomerClaim
	repo.createClaimFn = func(c *entity.CustomerClaim) error {
		c.ID = 50
		captured = *c
		return nil
	}
	soRepo := &mockSORepo{
		getByIDFn: func(uint) (*entity.SaleOrder, error) {
			return &entity.SaleOrder{Model: gorm.Model{ID: 7}, OrderNumber: "SO2026-0042"}, nil
		},
	}
	notifier := &fakeNotifier{}

	in := claimDTO.CreateCustomerClaimDTO{
		OriginalOrderID: 7,
		Status:          "PENDING",
		CustomerName:    "ลูกค้าเคลม",
		Items: []claimDTO.CreateCustomerClaimItemDTO{
			{ProductID: 1, Qty: 2, UnitPrice: 250, Reason: "ชำรุด"},
		},
	}
	got, err := newService(repo, soRepo, notifier).CreateCustomerClaim(in, 9)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if captured.ClaimNo != "CLM-SO2026-0042" {
		t.Errorf("expected CLM-SO2026-0042, got %q", captured.ClaimNo)
	}
	if got.ClaimNo != "CLM-SO2026-0042" {
		t.Errorf("response should carry ClaimNo, got %q", got.ClaimNo)
	}
	if got.OrderNumber != "SO2026-0042" {
		t.Errorf("response should carry OrderNumber, got %q", got.OrderNumber)
	}
	if len(notifier.records) != 1 || notifier.records[0].typ != "CUSTOMER_CLAIM_CREATED" || notifier.records[0].userID != 0 {
		t.Errorf("owners should be notified exactly once about creation, got %+v", notifier.records)
	}
}

func TestCreateCustomerClaim_ClaimNoFallbackWhenOrderLookupFails(t *testing.T) {
	repo := newMockClaimRepo()
	repo.createClaimFn = func(*entity.CustomerClaim) error { return nil }
	soRepo := &mockSORepo{} // lookup ไม่เจอ -> ErrRecordNotFound

	got, err := newService(repo, soRepo, nil).CreateCustomerClaim(claimDTO.CreateCustomerClaimDTO{
		OriginalOrderID: 123,
		Status:          "PENDING",
	}, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.ClaimNo != "CLM-123" {
		t.Errorf("expected fallback CLM-123, got %q", got.ClaimNo)
	}
}

func TestCreateCustomerClaim_AutoCalcAmountFromItems(t *testing.T) {
	tests := []struct {
		name       string
		inputAmt   float64
		items      []claimDTO.CreateCustomerClaimItemDTO
		wantAmount float64
	}{
		{
			name:       "auto calculate when zero",
			items:      []claimDTO.CreateCustomerClaimItemDTO{{Qty: 2, UnitPrice: 250}, {Qty: 1, UnitPrice: 99.5}},
			wantAmount: 599.5,
		},
		{
			name:       "keep provided amount",
			inputAmt:   1000,
			items:      []claimDTO.CreateCustomerClaimItemDTO{{Qty: 5, UnitPrice: 500}},
			wantAmount: 1000,
		},
		{
			name:       "no items keeps zero",
			wantAmount: 0,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMockClaimRepo()
			var captured entity.CustomerClaim
			repo.createClaimFn = func(c *entity.CustomerClaim) error {
				captured = *c
				return nil
			}
			in := claimDTO.CreateCustomerClaimDTO{OriginalOrderID: 1, Status: "PENDING", ClaimAmount: tt.inputAmt, Items: tt.items}
			if _, err := newService(repo, &mockSORepo{}, nil).CreateCustomerClaim(in, 1); err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if captured.ClaimAmount != tt.wantAmount {
				t.Errorf("ClaimAmount: want %v, got %v", tt.wantAmount, captured.ClaimAmount)
			}
		})
	}
}

func TestCreateCustomerClaim_DefaultsAndItemMirroring(t *testing.T) {
	repo := newMockClaimRepo()
	var header entity.CustomerClaim
	var createdItems []entity.CustomerClaimItem
	repo.createClaimFn = func(c *entity.CustomerClaim) error {
		header = *c
		c.ID = 77
		return nil
	}
	repo.createItemFn = func(i *entity.CustomerClaimItem) error {
		cp := *i
		cp.ID = uint(len(createdItems) + 1) //nolint:gosec // test data
		createdItems = append(createdItems, cp)
		return nil
	}

	before := time.Now().Add(-time.Minute)
	in := claimDTO.CreateCustomerClaimDTO{
		OriginalOrderID: 3,
		Status:          "APPROVED",
		Items: []claimDTO.CreateCustomerClaimItemDTO{
			{ProductID: 1, Qty: 1, UnitPrice: 10, Reason: "r"},
			{ProductID: 2, Qty: 2, UnitPrice: 20, Reason: "r"},
		},
		// CreatedBy ไม่มีใน DTO — service stamp จาก param
	}
	got, err := newService(repo, &mockSORepo{}, nil).CreateCustomerClaim(in, 0) // createdBy=0 -> default 1
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if header.CreatedBy != 1 {
		t.Errorf("expected CreatedBy defaulted to 1, got %d", header.CreatedBy)
	}
	if header.ClaimDate.Before(before) {
		t.Errorf("expected ClaimDate stamped ~now, got %v", header.ClaimDate)
	}
	if got.ID != 77 {
		t.Errorf("response should carry created ID, got %d", got.ID)
	}
	for i, it := range createdItems {
		if it.CustomerClaimID != 77 {
			t.Errorf("item[%d] not linked to claim 77: %d", i, it.CustomerClaimID)
		}
		if it.Status != "APPROVED" {
			t.Errorf("item[%d] status should mirror claim status APPROVED, got %q", i, it.Status)
		}
	}
}

// -----------------------------------------------------------------------------
// UpdateCustomerClaimItemStatus -> syncParentClaimStatus
// -----------------------------------------------------------------------------

type syncFixture struct {
	repo     *mockClaimRepo
	parent   *entity.CustomerClaim
	notifier *fakeNotifier
}

// newSyncFixture จำลอง DB จริง: update item แล้ว parent.Items เปลี่ยนตาม
func newSyncFixture(itemStatuses ...string) *syncFixture {
	f := &syncFixture{
		parent:   claimWithItems(10, "PENDING", 3, itemStatuses...),
		notifier: &fakeNotifier{},
		repo:     newMockClaimRepo(),
	}
	f.repo.getItemFn = func(id uint) (*entity.CustomerClaimItem, error) {
		for i := range f.parent.Items {
			if f.parent.Items[i].ID == id {
				cp := f.parent.Items[i]
				return &cp, nil
			}
		}
		return nil, gorm.ErrRecordNotFound
	}
	f.repo.updateItemFn = func(it *entity.CustomerClaimItem) error {
		for i := range f.parent.Items {
			if f.parent.Items[i].ID == it.ID {
				f.parent.Items[i].Status = it.Status
			}
		}
		return nil
	}
	f.repo.getClaimFn = func(uint) (*entity.CustomerClaim, error) {
		cp := *f.parent
		return &cp, nil
	}
	f.repo.updateClaimFn = func(c *entity.CustomerClaim) error {
		f.parent.Status = c.Status
		return nil
	}
	return f
}

func TestUpdateCustomerClaimItemStatus_ApproveAll_NotifiesCreatorOnce(t *testing.T) {
	f := newSyncFixture("APPROVED", "Pending")
	soRepo := &mockSORepo{}

	got, err := newService(f.repo, soRepo, f.notifier).UpdateCustomerClaimItemStatus(2, "APPROVED")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != "APPROVED" {
		t.Errorf("item status expected APPROVED, got %q", got.Status)
	}
	if f.parent.Status != "APPROVED" {
		t.Errorf("parent expected APPROVED after all items approved, got %q", f.parent.Status)
	}
	if len(f.notifier.records) != 1 {
		t.Fatalf("expected exactly 1 notification, got %+v", f.notifier.records)
	}
	r := f.notifier.records[0]
	if r.userID != 3 || r.typ != "CUSTOMER_CLAIM_APPROVED" {
		t.Errorf("notification should target creator 3 with type CUSTOMER_CLAIM_APPROVED, got %+v", r)
	}
}

func TestUpdateCustomerClaimItemStatus_MixedAnyApprovedMeansApproved_NoNotifOnSameState(t *testing.T) {
	// [APPROVED, Pending] -> reject ชิ้นที่เหลือ: anyApproved ยัง true -> parent APPROVED (ไม่ใช่ REJECTED)
	f := newSyncFixture("APPROVED", "Pending")
	got, err := newService(f.repo, &mockSORepo{}, f.notifier).UpdateCustomerClaimItemStatus(2, "REJECTED")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != "REJECTED" {
		t.Errorf("item expected REJECTED, got %q", got.Status)
	}
	if f.parent.Status != "APPROVED" {
		t.Errorf("anyApproved rule: parent expected to stay APPROVED, got %q", f.parent.Status)
	}
	// parent เดิม PENDING -> เปลี่ยนเป็น APPROVED = มี transition จริง -> ต้องแจ้ง
	if len(f.notifier.records) != 1 || f.notifier.records[0].typ != "CUSTOMER_CLAIM_APPROVED" {
		t.Errorf("expected approval notification on transition, got %+v", f.notifier.records)
	}
}

func TestUpdateCustomerClaimItemStatus_AllRejected_ParentRejectedWithRejectionNotice(t *testing.T) {
	f := newSyncFixture("Pending", "Pending")
	// ปฏิเสธชิ้นแรก -> ยังมี Pending -> PENDING ไม่แจ้ง
	if _, err := newService(f.repo, &mockSORepo{}, f.notifier).UpdateCustomerClaimItemStatus(1, "REJECTED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.parent.Status != "PENDING" || len(f.notifier.records) != 0 {
		t.Fatalf("partial rejection should keep PENDING without notice, got %q / %+v", f.parent.Status, f.notifier.records)
	}
	// ปฏิเสธชิ้นที่สอง -> allRejected -> REJECTED + แจ้งปฏิเสธ
	if _, err := newService(f.repo, &mockSORepo{}, f.notifier).UpdateCustomerClaimItemStatus(2, "REJECTED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if f.parent.Status != "REJECTED" {
		t.Errorf("parent expected REJECTED, got %q", f.parent.Status)
	}
	if len(f.notifier.records) != 1 || f.notifier.records[0].typ != "CUSTOMER_CLAIM_REJECTED" || f.notifier.records[0].userID != 3 {
		t.Errorf("expected single rejection notice to creator 3, got %+v", f.notifier.records)
	}
}

func TestUpdateCustomerClaimItemStatus_AlreadyApproved_NoDuplicateNotice(t *testing.T) {
	f := newSyncFixture("APPROVED", "APPROVED")
	f.parent.Status = "APPROVED" // ใบเคลมอนุมัติไปก่อนแล้ว
	if _, err := newService(f.repo, &mockSORepo{}, f.notifier).UpdateCustomerClaimItemStatus(1, "APPROVED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.notifier.records) != 0 {
		t.Errorf("no status transition -> should not notify again, got %+v", f.notifier.records)
	}
}

func TestUpdateCustomerClaimItemStatus_ItemNotFound_NoParentTouch(t *testing.T) {
	f := newSyncFixture("Pending")
	_, err := newService(f.repo, &mockSORepo{}, f.notifier).UpdateCustomerClaimItemStatus(999, "APPROVED")
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
	if f.repo.called["UpdateCustomerClaim"] != 0 {
		t.Error("parent must not be synced when item missing")
	}
}

// -----------------------------------------------------------------------------
// UpdateCustomerClaim / Delete / List passthrough
// -----------------------------------------------------------------------------

func TestUpdateCustomerClaim_AppliesOnlyProvidedFields(t *testing.T) {
	existing := claimWithItems(10, "PENDING", 3)
	existing.Note = "เดิม"
	existing.CustomerName = "ชื่อเดิม"

	repo := newMockClaimRepo()
	repo.getClaimFn = func(uint) (*entity.CustomerClaim, error) { return existing, nil }
	var updated *entity.CustomerClaim
	repo.updateClaimFn = func(c *entity.CustomerClaim) error {
		cp := *c
		updated = &cp
		return nil
	}

	newNote := "แนบรูปแล้ว"
	newName := "ชื่อใหม่"
	approver := uint(8)
	got, err := newService(repo, &mockSORepo{}, nil).UpdateCustomerClaim(10, claimDTO.UpdateCustomerClaimDTO{
		Notes:        newNote,
		CustomerName: newName,
		ApprovedBy:   &approver,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated.Note != newNote || updated.CustomerName != newName {
		t.Errorf("provided fields not applied: %+v", updated)
	}
	if updated.Status != "PENDING" {
		t.Errorf("empty field must not overwrite status, got %q", updated.Status)
	}
	if updated.ApprovedBy == nil || *updated.ApprovedBy != 8 {
		t.Errorf("approver not recorded: %v", updated.ApprovedBy)
	}
	if got.ApprovedBy == nil || *got.ApprovedBy != 8 {
		t.Errorf("response missing approver: %+v", got)
	}
}

func TestUpdateCustomerClaim_NotFound_DoesNotCallUpdate(t *testing.T) {
	repo := newMockClaimRepo() // default getClaimFn -> ErrRecordNotFound
	note := "x"
	_, err := newService(repo, &mockSORepo{}, nil).UpdateCustomerClaim(999, claimDTO.UpdateCustomerClaimDTO{Notes: note})
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
	if repo.called["UpdateCustomerClaim"] != 0 {
		t.Error("repo.UpdateCustomerClaim should not be called on missing record")
	}
}

func TestDeleteCustomerClaim_Passthrough(t *testing.T) {
	repo := newMockClaimRepo()
	var gotID uint
	repo.deleteClaimFn = func(id uint) error { gotID = id; return errors.New("fk blocked") }
	err := newService(repo, &mockSORepo{}, nil).DeleteCustomerClaim(21)
	if gotID != 21 {
		t.Errorf("expected id forwarded, got %d", gotID)
	}
	if err == nil || err.Error() != "fk blocked" {
		t.Errorf("expected error passthrough, got %v", err)
	}
}

func TestListCustomerClaims_MapsEachEntity(t *testing.T) {
	repo := newMockClaimRepo()
	repo.listClaimsFn = func() ([]entity.CustomerClaim, error) {
		a := claimWithItems(1, "PENDING", 1)
		b := claimWithItems(2, "APPROVED", 2)
		return []entity.CustomerClaim{*a, *b}, nil
	}
	got, err := newService(repo, &mockSORepo{}, nil).ListCustomerClaims()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 || got[0].ID != 1 || got[1].Status != "APPROVED" {
		t.Errorf("unexpected list mapping: %+v", got)
	}
}

func TestUpdateCustomerClaimItem_CompletedCannotBeEdited(t *testing.T) {
	repo := newMockClaimRepo()
	repo.getItemFn = func(id uint) (*entity.CustomerClaimItem, error) {
		return &entity.CustomerClaimItem{
			Model:      gorm.Model{ID: 10},
			Resolution: "COMPLETED",
			Status:     "APPROVED",
		}, nil
	}

	svc := newService(repo, &mockSORepo{}, nil)
	_, err := svc.UpdateCustomerClaimItem(10, claimDTO.UpdateCustomerClaimItemDTO{
		Resolution: "WAITING_SEND",
	})
	if err == nil {
		t.Fatal("expected error when updating completed item, got nil")
	}

	_, errStatus := svc.UpdateCustomerClaimItemStatus(10, "REJECTED")
	if errStatus == nil {
		t.Fatal("expected error when updating status of completed item, got nil")
	}
}

// -----------------------------------------------------------------------------
// Stock movement: จ่ายสินค้าทดแทนออก (INSTANT อนุมัติ / SUPPLIER_PENDING ส่งเคลม) และรับกลับ (ได้รับของเปลี่ยน)
// -----------------------------------------------------------------------------

// newStockFixture จำลอง DB จริงคล้าย newSyncFixture แต่ตั้งค่า ProductID/ClaimType ที่ตรรกะสต็อกต้องใช้
func newStockFixture(item entity.CustomerClaimItem) *syncFixture {
	item.CustomerClaimID = 10
	f := &syncFixture{
		parent: &entity.CustomerClaim{
			Model: gorm.Model{ID: 10}, ClaimNo: "CLM-STOCK-1", Status: "PENDING", CreatedBy: 3,
			Items: []entity.CustomerClaimItem{item},
		},
		notifier: &fakeNotifier{},
		repo:     newMockClaimRepo(),
	}
	f.repo.getItemFn = func(id uint) (*entity.CustomerClaimItem, error) {
		for i := range f.parent.Items {
			if f.parent.Items[i].ID == id {
				cp := f.parent.Items[i]
				return &cp, nil
			}
		}
		return nil, gorm.ErrRecordNotFound
	}
	f.repo.updateItemFn = func(it *entity.CustomerClaimItem) error {
		for i := range f.parent.Items {
			if f.parent.Items[i].ID == it.ID {
				f.parent.Items[i] = *it
			}
		}
		return nil
	}
	f.repo.getClaimFn = func(uint) (*entity.CustomerClaim, error) {
		cp := *f.parent
		return &cp, nil
	}
	f.repo.updateClaimFn = func(c *entity.CustomerClaim) error {
		f.parent.Status = c.Status
		return nil
	}
	return f
}

func TestUpdateCustomerClaimItemStatus_InstantApproved_DeductsStockOnce(t *testing.T) {
	f := newStockFixture(entity.CustomerClaimItem{
		Model: gorm.Model{ID: 1}, Status: "Pending", ClaimType: "INSTANT", ProductID: 55, Qty: 2,
	})
	svc := newService(f.repo, &mockSORepo{}, f.notifier)

	if _, err := svc.UpdateCustomerClaimItemStatus(1, "APPROVED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.stockAdjustments) != 1 {
		t.Fatalf("expected exactly one stock adjustment, got %+v", f.repo.stockAdjustments)
	}
	adj := f.repo.stockAdjustments[0]
	if adj.productID != 55 || adj.delta != -2 || adj.movementType != "CLAIM_OUT" {
		t.Errorf("expected -2 CLAIM_OUT for product 55, got %+v", adj)
	}
	if !f.parent.Items[0].StockOutIssued {
		t.Error("StockOutIssued should be persisted as true after issuing")
	}

	// เปลี่ยนสถานะไปมา (APPROVED -> REJECTED -> APPROVED ใหม่) ต้องไม่ตัดสต็อกซ้ำ เพราะของจริงจ่ายให้ลูกค้าไปแล้วครั้งเดียว
	if _, err := svc.UpdateCustomerClaimItemStatus(1, "REJECTED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := svc.UpdateCustomerClaimItemStatus(1, "APPROVED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.stockAdjustments) != 1 {
		t.Fatalf("re-approving must not deduct stock again, expected 1 adjustment total, got %+v", f.repo.stockAdjustments)
	}
}

func TestUpdateCustomerClaimItemStatus_InstantStillPending_NoStockMovement(t *testing.T) {
	f := newStockFixture(entity.CustomerClaimItem{
		Model: gorm.Model{ID: 1}, Status: "Pending", ClaimType: "INSTANT", ProductID: 55, Qty: 2,
	})
	svc := newService(f.repo, &mockSORepo{}, f.notifier)

	if _, err := svc.UpdateCustomerClaimItemStatus(1, "REJECTED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.stockAdjustments) != 0 {
		t.Errorf("rejecting an INSTANT item must never deduct stock, got %+v", f.repo.stockAdjustments)
	}
}

func TestCreateCustomerClaimItem_SupplierPending_DeductsStockImmediately(t *testing.T) {
	repo := newMockClaimRepo()
	repo.createItemFn = func(i *entity.CustomerClaimItem) error {
		i.ID = 1
		return nil
	}
	svc := newService(repo, &mockSORepo{}, nil)

	_, err := svc.CreateCustomerClaimItem(claimDTO.CreateCustomerClaimItemDTO{
		ProductID: 77, Qty: 3, Reason: "ส่งเช็คโรงงาน", ClaimType: "SUPPLIER_PENDING",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.stockAdjustments) != 1 {
		t.Fatalf("expected exactly one stock adjustment, got %+v", repo.stockAdjustments)
	}
	adj := repo.stockAdjustments[0]
	if adj.productID != 77 || adj.delta != -3 || adj.movementType != "CLAIM_OUT" {
		t.Errorf("expected -3 CLAIM_OUT for product 77, got %+v", adj)
	}
}

func TestCreateCustomerClaimItem_InstantNotYetApproved_NoStockMovement(t *testing.T) {
	repo := newMockClaimRepo()
	repo.createItemFn = func(i *entity.CustomerClaimItem) error {
		i.ID = 1
		return nil
	}
	svc := newService(repo, &mockSORepo{}, nil)

	// ToEntity() ของ CreateCustomerClaimItemDTO ตั้ง Status เริ่มต้นเป็น "Pending" เสมอ
	_, err := svc.CreateCustomerClaimItem(claimDTO.CreateCustomerClaimItemDTO{
		ProductID: 77, Qty: 1, Reason: "ไฟไม่ติด", ClaimType: "INSTANT",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.stockAdjustments) != 0 {
		t.Errorf("INSTANT item still pending must not deduct stock yet, got %+v", repo.stockAdjustments)
	}
}

func TestCreateCustomerClaim_OwnerCreatedInstantAutoApproved_DeductsStockAtCreate(t *testing.T) {
	repo := newMockClaimRepo()
	repo.createClaimFn = func(c *entity.CustomerClaim) error { c.ID = 20; return nil }
	var createdItems []entity.CustomerClaimItem
	repo.createItemFn = func(i *entity.CustomerClaimItem) error {
		i.ID = uint(len(createdItems) + 1) //nolint:gosec // test data
		createdItems = append(createdItems, *i)
		return nil
	}
	svc := newService(repo, &mockSORepo{}, nil)

	// Owner สร้างใบเคลมเอง -> status ของ header/items เป็น APPROVED ทันที (ตาม claims.tsx: canApprove -> 'APPROVED')
	_, err := svc.CreateCustomerClaim(claimDTO.CreateCustomerClaimDTO{
		OriginalOrderID: 1, Status: "APPROVED",
		Items: []claimDTO.CreateCustomerClaimItemDTO{
			{ProductID: 9, Qty: 1, UnitPrice: 100, Reason: "ชำรุด", ClaimType: "INSTANT"},
		},
	}, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.stockAdjustments) != 1 {
		t.Fatalf("expected exactly one stock adjustment, got %+v", repo.stockAdjustments)
	}
	adj := repo.stockAdjustments[0]
	if adj.productID != 9 || adj.delta != -1 || adj.movementType != "CLAIM_OUT" {
		t.Errorf("expected -1 CLAIM_OUT for product 9, got %+v", adj)
	}
}

func TestUpdateCustomerClaimItem_ReplacementReceived_RestocksOnce(t *testing.T) {
	f := newStockFixture(entity.CustomerClaimItem{
		Model: gorm.Model{ID: 1}, Status: "Pending", ClaimType: "SUPPLIER_PENDING", ProductID: 42, Qty: 4,
		StockOutIssued: true, // สมมติว่าจ่ายของสำรองออกไปแล้วตอนสร้างใบเคลม
	})
	svc := newService(f.repo, &mockSORepo{}, f.notifier)

	if _, err := svc.UpdateCustomerClaimItem(1, claimDTO.UpdateCustomerClaimItemDTO{Resolution: "REPLACEMENT_RECEIVED"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.stockAdjustments) != 1 {
		t.Fatalf("expected exactly one stock adjustment, got %+v", f.repo.stockAdjustments)
	}
	adj := f.repo.stockAdjustments[0]
	if adj.productID != 42 || adj.delta != 4 || adj.movementType != "CLAIM_IN" {
		t.Errorf("expected +4 CLAIM_IN for product 42, got %+v", adj)
	}

	// กดยืนยันซ้ำ (เช่น แก้ไขข้อมูลอื่นในฟอร์มเดิมอีกครั้ง) ต้องไม่เติมสต็อกซ้ำ
	if _, err := svc.UpdateCustomerClaimItem(1, claimDTO.UpdateCustomerClaimItemDTO{Resolution: "REPLACEMENT_RECEIVED"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.stockAdjustments) != 1 {
		t.Fatalf("re-confirming receipt must not restock again, expected 1 adjustment total, got %+v", f.repo.stockAdjustments)
	}
}

// -----------------------------------------------------------------------------
// Credit account: หักยอดหนี้ค้างชำระของลูกค้าเมื่อรายการเคลมประเภท CREDIT_ACCOUNT ได้รับการอนุมัติ
// -----------------------------------------------------------------------------

func TestUpdateCustomerClaimItemStatus_CreditAccountApproved_ReducesDebtOnce(t *testing.T) {
	f := newStockFixture(entity.CustomerClaimItem{
		Model: gorm.Model{ID: 1}, Status: "Pending", ClaimType: "CREDIT_ACCOUNT", ProductID: 55, Qty: 2, UnitPrice: 300,
	})
	svc := newService(f.repo, &mockSORepo{}, f.notifier)

	if _, err := svc.UpdateCustomerClaimItemStatus(1, "APPROVED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.creditAdjustments) != 1 {
		t.Fatalf("expected exactly one credit adjustment, got %+v", f.repo.creditAdjustments)
	}
	adj := f.repo.creditAdjustments[0]
	if adj.claimID != 10 || adj.amount != 600 {
		t.Errorf("expected -600 debt reduction for claim 10, got %+v", adj)
	}
	if !f.parent.Items[0].CreditApplied {
		t.Error("CreditApplied should be persisted as true after reducing debt")
	}
	// CREDIT_ACCOUNT ไม่ใช่การจ่ายของทดแทนจริง จึงไม่ควรมีการตัดสต็อก
	if len(f.repo.stockAdjustments) != 0 {
		t.Errorf("CREDIT_ACCOUNT approval must never move stock, got %+v", f.repo.stockAdjustments)
	}

	// สลับสถานะไปมา (APPROVED -> REJECTED -> APPROVED ใหม่) ต้องไม่หักหนี้ซ้ำ เพราะยอดหนี้ถูกหักจริงแค่ครั้งเดียว
	if _, err := svc.UpdateCustomerClaimItemStatus(1, "REJECTED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if _, err := svc.UpdateCustomerClaimItemStatus(1, "APPROVED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.creditAdjustments) != 1 {
		t.Fatalf("re-approving must not reduce debt again, expected 1 adjustment total, got %+v", f.repo.creditAdjustments)
	}
}

func TestUpdateCustomerClaimItemStatus_CreditAccountStillPending_NoDebtAdjustment(t *testing.T) {
	f := newStockFixture(entity.CustomerClaimItem{
		Model: gorm.Model{ID: 1}, Status: "Pending", ClaimType: "CREDIT_ACCOUNT", ProductID: 55, Qty: 2, UnitPrice: 300,
	})
	svc := newService(f.repo, &mockSORepo{}, f.notifier)

	if _, err := svc.UpdateCustomerClaimItemStatus(1, "REJECTED"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(f.repo.creditAdjustments) != 0 {
		t.Errorf("rejecting a CREDIT_ACCOUNT item must never reduce debt, got %+v", f.repo.creditAdjustments)
	}
}

func TestCreateCustomerClaim_OwnerCreatedCreditAccountAutoApproved_ReducesDebtAtCreate(t *testing.T) {
	repo := newMockClaimRepo()
	repo.createClaimFn = func(c *entity.CustomerClaim) error { c.ID = 30; return nil }
	var createdItems []entity.CustomerClaimItem
	repo.createItemFn = func(i *entity.CustomerClaimItem) error {
		i.ID = uint(len(createdItems) + 1) //nolint:gosec // test data
		createdItems = append(createdItems, *i)
		return nil
	}
	svc := newService(repo, &mockSORepo{}, nil)

	_, err := svc.CreateCustomerClaim(claimDTO.CreateCustomerClaimDTO{
		OriginalOrderID: 1, Status: "APPROVED",
		Items: []claimDTO.CreateCustomerClaimItemDTO{
			{ProductID: 9, Qty: 3, UnitPrice: 150, Reason: "ชำรุด", ClaimType: "CREDIT_ACCOUNT"},
		},
	}, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(repo.creditAdjustments) != 1 {
		t.Fatalf("expected exactly one credit adjustment, got %+v", repo.creditAdjustments)
	}
	adj := repo.creditAdjustments[0]
	if adj.claimID != 30 || adj.amount != 450 {
		t.Errorf("expected -450 debt reduction for claim 30, got %+v", adj)
	}
}
