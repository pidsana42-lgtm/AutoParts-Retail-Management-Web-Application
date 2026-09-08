package preorder

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	preOrderDTO "backend/internal/app/dto/pre_oder"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	preOrderRepo "backend/internal/app/repository/pre_oder"
	preOrderService "backend/internal/app/service/pre_oder"

	"gorm.io/gorm"
)

// -----------------------------------------------------------------------------
// Mock Repository
// -----------------------------------------------------------------------------

type mockPreOrderRepo struct {
	createPreOrderFn       func(*entity.PreOrder) error
	createItemFn           func(*entity.PreOrderItem) error
	getPreOrderByIDFn      func(id uint) (*entity.PreOrder, error)
	listPreOrdersFn        func() ([]entity.PreOrder, error)
	updatePreOrderFn       func(*entity.PreOrder) error
	deletePreOrderFn       func(id uint) error
	getLineUserIDFn        func(customerID uint) (string, error)
	listByStatusFn         func(ctx context.Context, status string) ([]entity.PreOrder, error)
	updateItemsStatusFn    func(ctx context.Context, ids []uint, status string) error
	getLinkedPOsFn         func(ctx context.Context, itemIDs []uint) (map[uint]entity.PO, error)
	findOrCreateCustomerFn func(name, phone string) (uint, error)

	called map[string]int
}

func uintPtr(u uint) *uint { return &u }

// compile-time check: mock ต้อง implement PreOrderRepository ครบทุก method
var _ preOrderRepo.PreOrderRepository = (*mockPreOrderRepo)(nil)

func newMockRepo() *mockPreOrderRepo {
	return &mockPreOrderRepo{called: map[string]int{}}
}

func (m *mockPreOrderRepo) track(name string) {
	m.called[name]++
}

func (m *mockPreOrderRepo) CreatePreOrder(po *entity.PreOrder) error {
	m.track("CreatePreOrder")
	if m.createPreOrderFn != nil {
		return m.createPreOrderFn(po)
	}
	po.ID = 1
	return nil
}

func (m *mockPreOrderRepo) FindOrCreateCustomerByName(name, phone string) (uint, error) {
	m.track("FindOrCreateCustomerByName")
	if m.findOrCreateCustomerFn != nil {
		return m.findOrCreateCustomerFn(name, phone)
	}
	return 1, nil
}

func (m *mockPreOrderRepo) CreatePreOrderItem(item *entity.PreOrderItem) error {
	m.track("CreatePreOrderItem")
	if m.createItemFn != nil {
		return m.createItemFn(item)
	}
	item.ID = 1
	return nil
}

func (m *mockPreOrderRepo) GetPreOrderByID(id uint) (*entity.PreOrder, error) {
	m.track("GetPreOrderByID")
	if m.getPreOrderByIDFn != nil {
		return m.getPreOrderByIDFn(id)
	}
	return &entity.PreOrder{}, nil
}

func (m *mockPreOrderRepo) ListPreOrders() ([]entity.PreOrder, error) {
	m.track("ListPreOrders")
	if m.listPreOrdersFn != nil {
		return m.listPreOrdersFn()
	}
	return nil, nil
}

func (m *mockPreOrderRepo) UpdatePreOrder(po *entity.PreOrder) error {
	m.track("UpdatePreOrder")
	if m.updatePreOrderFn != nil {
		return m.updatePreOrderFn(po)
	}
	return nil
}

func (m *mockPreOrderRepo) DeletePreOrder(id uint) error {
	m.track("DeletePreOrder")
	if m.deletePreOrderFn != nil {
		return m.deletePreOrderFn(id)
	}
	return nil
}

func (m *mockPreOrderRepo) GetLineUserIDByCustomerID(customerID uint) (string, error) {
	m.track("GetLineUserIDByCustomerID")
	if m.getLineUserIDFn != nil {
		return m.getLineUserIDFn(customerID)
	}
	return "", nil
}

func (m *mockPreOrderRepo) ListByStatus(ctx context.Context, status string) ([]entity.PreOrder, error) {
	m.track("ListByStatus")
	if m.listByStatusFn != nil {
		return m.listByStatusFn(ctx, status)
	}
	return nil, nil
}

func (m *mockPreOrderRepo) UpdateItemsStatusByIDs(ctx context.Context, ids []uint, status string) error {
	m.track("UpdateItemsStatusByIDs")
	if m.updateItemsStatusFn != nil {
		return m.updateItemsStatusFn(ctx, ids, status)
	}
	return nil
}

func (m *mockPreOrderRepo) GetLinkedPOsByItemIDs(ctx context.Context, itemIDs []uint) (map[uint]entity.PO, error) {
	m.track("GetLinkedPOsByItemIDs")
	if m.getLinkedPOsFn != nil {
		return m.getLinkedPOsFn(ctx, itemIDs)
	}
	return map[uint]entity.PO{}, nil
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

func newService(repo *mockPreOrderRepo) preOrderService.PreOrderService {
	return preOrderService.NewPreOrderService(repo)
}

func samplePreOrderEntity(id uint, status string, items ...entity.PreOrderItem) entity.PreOrder {
	for i := range items {
		items[i].ID = uint(i + 1) //nolint:gosec // test data
		items[i].PreOrderID = id
	}
	return entity.PreOrder{
		Model:        gorm.Model{ID: id},
		PreOrderType: "LINE",
		CustomerID:   10,
		Customer: &entity.Customer{
			Model:        gorm.Model{ID: 10},
			CustomerName: "ลูกค้าทดสอบ",
			PhoneNumber:  "0812345678",
		},
		DepositAmount: 500,
		Status:        status,
		OrderDate:     time.Date(2026, 8, 24, 10, 0, 0, 0, time.UTC),
		SupplierID:    2,
		Supplier: &entity.Supplier{
			Model:        gorm.Model{ID: 2},
			SupplierName: "ซัพพลายเออร์กลาง",
		},
		PreOrderItems: items,
	}
}

func linkedPO(itemID uint, id uint, number string, status enum.POStatus) map[uint]entity.PO {
	return map[uint]entity.PO{
		itemID: {
			Model:     gorm.Model{ID: id},
			PO_number: number,
			Status:    status,
		},
	}
}

// -----------------------------------------------------------------------------
// CreatePreOrder
// -----------------------------------------------------------------------------

func TestCreatePreOrder_Success(t *testing.T) {
	repo := newMockRepo()
	var captured entity.PreOrder
	repo.createPreOrderFn = func(po *entity.PreOrder) error {
		po.ID = 99 // จำลอง DB assign ID
		captured = *po
		return nil
	}

	orderDate := time.Date(2026, 8, 24, 9, 30, 0, 0, time.UTC)
	input := preOrderDTO.CreatePreOrderDTO{
		PreOrderType:  "LINE",
		CustomerID:    7,
		DepositAmount: 200,
		Status:        "PENDING",
		OrderDate:     orderDate,
		SupplierID:    0, // ต้องถูก default เป็น 1
		PreOrderItems: []preOrderDTO.CreatePreOrderItemDTO{
			{
				ProductID:        3,
				ProductName:      "กรองน้ำมันเครื่อง",
				ProductCode:      "OIL-001",
				SupplierPartCode: "SUP-OIL-99",
				SupplierName:     "บริษัทคู่ค้าทดสอบ",
				Quantity:         2,
				UnitPrice:        150.5,
			},
			{ProductID: 4, Quantity: 1, UnitPrice: 99},
		},
	}

	got, err := newService(repo).CreatePreOrder(input)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}
	if got.ID != 99 {
		t.Errorf("expected assigned ID 99, got %d", got.ID)
	}
	if captured.SupplierID != 1 {
		t.Errorf("expected SupplierID defaulted to 1, got %d", captured.SupplierID)
	}
	if captured.CustomerID != 7 || captured.PreOrderType != "LINE" || captured.Status != "PENDING" {
		t.Errorf("unexpected mapped entity: %+v", captured)
	}
	if !captured.OrderDate.Equal(orderDate) {
		t.Errorf("expected OrderDate %v, got %v", orderDate, captured.OrderDate)
	}
	if len(captured.PreOrderItems) != 2 {
		t.Fatalf("expected 2 items, got %d", len(captured.PreOrderItems))
	}
	if captured.PreOrderItems[0].ProductID == nil || *captured.PreOrderItems[0].ProductID != 3 || captured.PreOrderItems[0].Quantity != 2 || captured.PreOrderItems[0].UnitPrice != 150.5 {
		t.Errorf("item[0] not mapped correctly: %+v", captured.PreOrderItems[0])
	}
	if captured.PreOrderItems[0].ProductNameSnapshot != "กรองน้ำมันเครื่อง" ||
		captured.PreOrderItems[0].ProductCodeSnapshot != "OIL-001" ||
		captured.PreOrderItems[0].SupplierPartCode != "SUP-OIL-99" ||
		captured.PreOrderItems[0].SupplierName != "บริษัทคู่ค้าทดสอบ" {
		t.Errorf("item snapshot fields not mapped correctly: %+v", captured.PreOrderItems[0])
	}
	if len(got.PreOrderItems) != 2 {
		t.Errorf("expected 2 items in response, got %d", len(got.PreOrderItems))
	}
	if got.PreOrderItems[0].SupplierPartCode != "SUP-OIL-99" || got.PreOrderItems[0].SupplierName != "บริษัทคู่ค้าทดสอบ" {
		t.Errorf("snapshot fields missing from response: %+v", got.PreOrderItems[0])
	}
}

func TestCreatePreOrder_KeepsProvidedSupplierID(t *testing.T) {
	repo := newMockRepo()
	repo.createPreOrderFn = func(po *entity.PreOrder) error {
		po.ID = 1
		return nil
	}
	input := preOrderDTO.CreatePreOrderDTO{
		PreOrderType: "STORE",
		CustomerID:   1,
		Status:       "PENDING",
		OrderDate:    time.Now(),
		SupplierID:   42,
	}
	got, err := newService(repo).CreatePreOrder(input)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.SupplierID != 42 {
		t.Errorf("expected SupplierID 42 kept, got %d", got.SupplierID)
	}
}

func TestCreatePreOrder_RepoError(t *testing.T) {
	repo := newMockRepo()
	wantErr := errors.New("db down")
	repo.createPreOrderFn = func(*entity.PreOrder) error { return wantErr }

	_, err := newService(repo).CreatePreOrder(preOrderDTO.CreatePreOrderDTO{
		PreOrderType: "LINE",
		CustomerID:   1,
		Status:       "PENDING",
		OrderDate:    time.Now(),
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("expected error %v, got %v", wantErr, err)
	}
}

// -----------------------------------------------------------------------------
// GetPreOrderByID — การ mapping สถานะจาก PO ที่ผูกกับ item
// -----------------------------------------------------------------------------

func TestGetPreOrderByID_StatusMappingWithLinkedPO(t *testing.T) {
	base := samplePreOrderEntity(5, "PENDING", entity.PreOrderItem{Quantity: 1, UnitPrice: 100})

	tests := []struct {
		name       string
		baseStatus string
		poStatus   enum.POStatus
		wantStatus string
	}{
		{"approved -> ordered", "PENDING", enum.StatusApproved, "ORDERED"},
		{"pending -> po_pending", "PENDING", enum.StatusPending, "PO_PENDING"},
		{"draft -> po_draft", "PENDING", enum.StatusDraft, "PO_DRAFT"},
		{"completed stays completed", "COMPLETED", enum.StatusApproved, "COMPLETED"},
		{"cancelled stays cancelled", "CANCELLED", enum.StatusApproved, "CANCELLED"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMockRepo()
			ent := base
			ent.Status = tt.baseStatus
			repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) { return &ent, nil }
			repo.getLinkedPOsFn = func(_ context.Context, ids []uint) (map[uint]entity.PO, error) {
				return linkedPO(ids[0], 77, "PO-00077", tt.poStatus), nil
			}

			got, err := newService(repo).GetPreOrderByID(5)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.Status != tt.wantStatus {
				t.Errorf("status: want %q, got %q", tt.wantStatus, got.Status)
			}
			if got.POID == nil || *got.POID != 77 {
				t.Errorf("expected POID 77, got %v", got.POID)
			}
			if got.PONumber != "PO-00077" {
				t.Errorf("expected PO number PO-00077, got %q", got.PONumber)
			}
			if got.POStatus != string(tt.poStatus) {
				t.Errorf("expected POStatus %q, got %q", string(tt.poStatus), got.POStatus)
			}
		})
	}
}

func TestGetPreOrderByID_NoLinkedPO_KeepsOriginalFields(t *testing.T) {
	repo := newMockRepo()
	ent := samplePreOrderEntity(5, "PENDING", entity.PreOrderItem{Quantity: 3, UnitPrice: 250})
	repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) { return &ent, nil }
	repo.getLinkedPOsFn = func(_ context.Context, _ []uint) (map[uint]entity.PO, error) {
		return map[uint]entity.PO{}, nil
	}

	got, err := newService(repo).GetPreOrderByID(5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got.Status != "PENDING" {
		t.Errorf("expected original status PENDING, got %q", got.Status)
	}
	if got.POID != nil || got.PONumber != "" || got.POStatus != "" {
		t.Errorf("expected empty PO linkage, got %+v", got)
	}
	if got.CustomerName != "ลูกค้าทดสอบ" || got.CustomerPhone != "0812345678" {
		t.Errorf("customer fields not mapped: %+v", got)
	}
	if got.SupplierName != "ซัพพลายเออร์กลาง" {
		t.Errorf("supplier name not mapped: %q", got.SupplierName)
	}
}

func TestGetPreOrderByID_NotFound(t *testing.T) {
	repo := newMockRepo()
	repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) {
		return nil, gorm.ErrRecordNotFound
	}
	_, err := newService(repo).GetPreOrderByID(999)
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
}

// -----------------------------------------------------------------------------
// ListPreOrders
// -----------------------------------------------------------------------------

func TestListPreOrders_MapsEachOrderAndCollectsAllItemIDs(t *testing.T) {
	repo := newMockRepo()
	first := samplePreOrderEntity(1, "PENDING",
		entity.PreOrderItem{Quantity: 1, UnitPrice: 100},
		entity.PreOrderItem{Quantity: 2, UnitPrice: 200},
	)
	first.PreOrderItems[0].ID = 11
	first.PreOrderItems[1].ID = 12
	second := samplePreOrderEntity(2, "PENDING", entity.PreOrderItem{Quantity: 5, UnitPrice: 40})
	second.PreOrderItems[0].ID = 13

	repo.listPreOrdersFn = func() ([]entity.PreOrder, error) {
		return []entity.PreOrder{first, second}, nil
	}

	var receivedIDs []uint
	repo.getLinkedPOsFn = func(_ context.Context, ids []uint) (map[uint]entity.PO, error) {
		receivedIDs = append(receivedIDs, ids...)
		out := map[uint]entity.PO{}
		for _, id := range ids {
			if id == 12 {
				out[id] = entity.PO{Model: gorm.Model{ID: 9}, PO_number: "PO-00009", Status: enum.StatusApproved}
			}
		}
		return out, nil
	}

	got, err := newService(repo).ListPreOrders()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("expected 2 orders, got %d", len(got))
	}
	if !reflect.DeepEqual(receivedIDs, []uint{11, 12, 13}) {
		t.Errorf("expected all item IDs collected [11 12 13], got %v", receivedIDs)
	}
	if got[0].Status != "ORDERED" {
		t.Errorf("first order has item linked to APPROVED PO, expected ORDERED, got %q", got[0].Status)
	}
	if got[0].POID == nil || *got[0].POID != 9 {
		t.Errorf("first order expected POID 9, got %v", got[0].POID)
	}
	if got[1].Status != "PENDING" || got[1].PONumber != "" {
		t.Errorf("second order expected untouched PENDING without PO, got %+v", got[1])
	}
}

func TestListPreOrders_RepoError(t *testing.T) {
	repo := newMockRepo()
	wantErr := errors.New("boom")
	repo.listPreOrdersFn = func() ([]entity.PreOrder, error) { return nil, wantErr }
	if _, err := newService(repo).ListPreOrders(); !errors.Is(err, wantErr) {
		t.Fatalf("expected %v, got %v", wantErr, err)
	}
}

// -----------------------------------------------------------------------------
// UpdatePreOrder / DeletePreOrder
// -----------------------------------------------------------------------------

func TestUpdatePreOrder_AppliesOnlyProvidedFields(t *testing.T) {
	repo := newMockRepo()
	existing := samplePreOrderEntity(5, "PENDING", entity.PreOrderItem{ProductID: uintPtr(3), Quantity: 1, UnitPrice: 100})
	existing.DepositAmount = 100

	repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) { return &existing, nil }

	var updated *entity.PreOrder
	repo.updatePreOrderFn = func(po *entity.PreOrder) error {
		cp := *po
		updated = &cp
		return nil
	}

	newStatus := "COMPLETED"
	newDeposit := 750.5
	newType := "TEL"
	got, err := newService(repo).UpdatePreOrder(5, preOrderDTO.UpdatePreOrderDTO{
		Status:        &newStatus,
		DepositAmount: &newDeposit,
		PreOrderType:  &newType,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if updated == nil {
		t.Fatal("repo.UpdatePreOrder was not called")
	}
	if updated.Status != "COMPLETED" || updated.DepositAmount != 750.5 || updated.PreOrderType != "TEL" {
		t.Errorf("changes not applied: %+v", updated)
	}
	if updated.CustomerID != 10 {
		t.Errorf("untouched field changed: CustomerID %d", updated.CustomerID)
	}
	if got.Status != "COMPLETED" || got.DepositAmount != 750.5 {
		t.Errorf("response not reflecting update: %+v", got)
	}
}

func TestUpdatePreOrder_NotFound_DoesNotCallUpdate(t *testing.T) {
	repo := newMockRepo()
	repo.getPreOrderByIDFn = func(uint) (*entity.PreOrder, error) {
		return nil, gorm.ErrRecordNotFound
	}
	status := "COMPLETED"
	_, err := newService(repo).UpdatePreOrder(999, preOrderDTO.UpdatePreOrderDTO{Status: &status})
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected ErrRecordNotFound, got %v", err)
	}
	if repo.called["UpdatePreOrder"] != 0 {
		t.Errorf("repo.UpdatePreOrder should not be called on missing record, called %d times", repo.called["UpdatePreOrder"])
	}
}

func TestDeletePreOrder_PassesIDAndError(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		repo := newMockRepo()
		var gotID uint
		repo.deletePreOrderFn = func(id uint) error { gotID = id; return nil }
		if err := newService(repo).DeletePreOrder(123); err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if gotID != 123 {
			t.Errorf("expected id 123 forwarded, got %d", gotID)
		}
	})
	t.Run("error passthrough", func(t *testing.T) {
		repo := newMockRepo()
		wantErr := errors.New("constraint fail")
		repo.deletePreOrderFn = func(uint) error { return wantErr }
		if err := newService(repo).DeletePreOrder(1); !errors.Is(err, wantErr) {
			t.Fatalf("expected %v, got %v", wantErr, err)
		}
	})
}

// -----------------------------------------------------------------------------
// ListPreOrdersForPOSelection
// -----------------------------------------------------------------------------

func TestListPreOrdersForPOSelection_QueriesPendingAndMapsItems(t *testing.T) {
	repo := newMockRepo()
	ent := samplePreOrderEntity(5, "PENDING",
		entity.PreOrderItem{
			ProductID: uintPtr(3),
			Quantity:  2,
			UnitPrice: 199.99,
			Status:    "PENDING",
			Product: &entity.Product{
				Product_Code: "SPK-001",
				Product_Name: "กรองน้ำมันเครื่อง",
				Unit:         &entity.Unit{Unit_Name: "ชิ้น"},
			},
		},
	)
	var gotStatus string
	repo.listByStatusFn = func(_ context.Context, status string) ([]entity.PreOrder, error) {
		gotStatus = status
		return []entity.PreOrder{ent}, nil
	}

	got, err := newService(repo).ListPreOrdersForPOSelection(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if gotStatus != "PENDING" {
		t.Errorf("expected repo queried with PENDING, got %q", gotStatus)
	}
	if len(got) != 1 || len(got[0].PreOrderItems) != 1 {
		t.Fatalf("unexpected result shape: %+v", got)
	}
	item := got[0].PreOrderItems[0]
	if item.ProductCode != "SPK-001" || item.ProductName != "กรองน้ำมันเครื่อง" || item.Unit != "ชิ้น" {
		t.Errorf("product fields not mapped: %+v", item)
	}
	if item.Quantity != 2 || item.UnitPrice != 199.99 || item.Status != "PENDING" {
		t.Errorf("numeric/status fields not mapped: %+v", item)
	}
}

func TestListPreOrdersForPOSelection_RepoError(t *testing.T) {
	repo := newMockRepo()
	wantErr := errors.New("ctx timeout")
	repo.listByStatusFn = func(_ context.Context, _ string) ([]entity.PreOrder, error) { return nil, wantErr }
	if _, err := newService(repo).ListPreOrdersForPOSelection(context.Background()); !errors.Is(err, wantErr) {
		t.Fatalf("expected %v, got %v", wantErr, err)
	}
}
