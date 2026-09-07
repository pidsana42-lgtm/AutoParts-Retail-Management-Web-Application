package wms

import (
	"errors"
	"strings"
	"testing"
	"time"

	wmsDTO "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"

	"gorm.io/gorm"
)

// ---------------------------------------------------------------------------
// mockMovementFeedRepo: fake ที่ implement wmsRepo.MovementFeedRepository
// แต่ละ ...Fn ปล่อย nil, nil เป็นค่า default (แหล่งข้อมูลนั้นไม่มีรายการ) ให้ test override เฉพาะแหล่งที่สนใจ
// ---------------------------------------------------------------------------

type mockMovementFeedRepo struct {
	listRecentProductsFn     func() ([]entity.Product, error)
	listStockInMovementsFn   func() ([]entity.StockMovement, error)
	listCheckSchedulesFn     func() ([]entity.CheckStockSchedule, error)
	listStockAdjustmentsFn   func() ([]entity.CheckStock, error)
	listLowStockProductsFn   func() ([]entity.Product, error)
	listSaleOutItemsFn       func() ([]entity.SaleOrderItem, error)
	listReturnMovementsFn    func() ([]entity.StockMovement, error)
	listCustomerClaimItemsFn func() ([]entity.CustomerClaimItem, error)
	listPreOrderItemsFn      func() ([]entity.PreOrderItem, error)
}

func (m *mockMovementFeedRepo) ListRecentProducts() ([]entity.Product, error) {
	if m.listRecentProductsFn != nil {
		return m.listRecentProductsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListStockInMovements() ([]entity.StockMovement, error) {
	if m.listStockInMovementsFn != nil {
		return m.listStockInMovementsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListCheckSchedules() ([]entity.CheckStockSchedule, error) {
	if m.listCheckSchedulesFn != nil {
		return m.listCheckSchedulesFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListStockAdjustments() ([]entity.CheckStock, error) {
	if m.listStockAdjustmentsFn != nil {
		return m.listStockAdjustmentsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListLowStockProducts() ([]entity.Product, error) {
	if m.listLowStockProductsFn != nil {
		return m.listLowStockProductsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListSaleOutItems() ([]entity.SaleOrderItem, error) {
	if m.listSaleOutItemsFn != nil {
		return m.listSaleOutItemsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListReturnMovements() ([]entity.StockMovement, error) {
	if m.listReturnMovementsFn != nil {
		return m.listReturnMovementsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListCustomerClaimItems() ([]entity.CustomerClaimItem, error) {
	if m.listCustomerClaimItemsFn != nil {
		return m.listCustomerClaimItemsFn()
	}
	return nil, nil
}

func (m *mockMovementFeedRepo) ListPreOrderItems() ([]entity.PreOrderItem, error) {
	if m.listPreOrderItemsFn != nil {
		return m.listPreOrderItemsFn()
	}
	return nil, nil
}

var _ wmsRepo.MovementFeedRepository = (*mockMovementFeedRepo)(nil)

func mustFindByType(t *testing.T, items []wmsDTO.MovementFeedItem, feedType string) wmsDTO.MovementFeedItem {
	t.Helper()
	for _, it := range items {
		if it.Type == feedType {
			return it
		}
	}
	t.Fatalf("expected an item of type %s in the feed, got %d items total", feedType, len(items))
	return wmsDTO.MovementFeedItem{}
}

// ---------------------------------------------------------------------------
// List: การรวม + เรียงลำดับ + ส่งต่อ error
// ---------------------------------------------------------------------------

func TestList_SortsAllSourcesByOccurredAtDescending(t *testing.T) {
	oldest := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	middle := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)
	newest := time.Date(2026, 9, 1, 0, 0, 0, 0, time.UTC)

	repo := &mockMovementFeedRepo{
		listRecentProductsFn: func() ([]entity.Product, error) {
			return []entity.Product{{Model: gorm.Model{ID: 1, CreatedAt: middle}, Product_Name: "Middle"}}, nil
		},
		listLowStockProductsFn: func() ([]entity.Product, error) {
			return []entity.Product{{Model: gorm.Model{ID: 2, UpdatedAt: oldest}, Product_Name: "Oldest"}}, nil
		},
		listStockInMovementsFn: func() ([]entity.StockMovement, error) {
			return []entity.StockMovement{{Model: gorm.Model{ID: 3}, Movement_DateTime: newest}}, nil
		},
	}

	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 3 {
		t.Fatalf("expected 3 items, got %d", len(items))
	}
	if !items[0].OccurredAt.Equal(newest) || !items[1].OccurredAt.Equal(middle) || !items[2].OccurredAt.Equal(oldest) {
		t.Errorf("expected items sorted newest-first, got order: %v, %v, %v", items[0].OccurredAt, items[1].OccurredAt, items[2].OccurredAt)
	}
}

func TestList_PropagatesErrorFromAnySource(t *testing.T) {
	wantErr := errors.New("db unavailable")

	tests := []struct {
		name    string
		setRepo func(r *mockMovementFeedRepo)
	}{
		{"ListRecentProducts", func(r *mockMovementFeedRepo) {
			r.listRecentProductsFn = func() ([]entity.Product, error) { return nil, wantErr }
		}},
		{"ListStockInMovements", func(r *mockMovementFeedRepo) {
			r.listStockInMovementsFn = func() ([]entity.StockMovement, error) { return nil, wantErr }
		}},
		{"ListCheckSchedules", func(r *mockMovementFeedRepo) {
			r.listCheckSchedulesFn = func() ([]entity.CheckStockSchedule, error) { return nil, wantErr }
		}},
		{"ListStockAdjustments", func(r *mockMovementFeedRepo) {
			r.listStockAdjustmentsFn = func() ([]entity.CheckStock, error) { return nil, wantErr }
		}},
		{"ListLowStockProducts", func(r *mockMovementFeedRepo) {
			r.listLowStockProductsFn = func() ([]entity.Product, error) { return nil, wantErr }
		}},
		{"ListSaleOutItems", func(r *mockMovementFeedRepo) {
			r.listSaleOutItemsFn = func() ([]entity.SaleOrderItem, error) { return nil, wantErr }
		}},
		{"ListReturnMovements", func(r *mockMovementFeedRepo) {
			r.listReturnMovementsFn = func() ([]entity.StockMovement, error) { return nil, wantErr }
		}},
		{"ListCustomerClaimItems", func(r *mockMovementFeedRepo) {
			r.listCustomerClaimItemsFn = func() ([]entity.CustomerClaimItem, error) { return nil, wantErr }
		}},
		{"ListPreOrderItems", func(r *mockMovementFeedRepo) {
			r.listPreOrderItemsFn = func() ([]entity.PreOrderItem, error) { return nil, wantErr }
		}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &mockMovementFeedRepo{}
			tt.setRepo(repo)
			svc := wmsService.NewMovementFeedService(repo)
			_, err := svc.List()
			if !errors.Is(err, wantErr) {
				t.Fatalf("expected error %v when %s fails, got %v", wantErr, tt.name, err)
			}
		})
	}
}

func TestList_EmptyEverywhere_ReturnsEmptySlice(t *testing.T) {
	repo := &mockMovementFeedRepo{}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 0 {
		t.Errorf("expected no items, got %d", len(items))
	}
}

// ---------------------------------------------------------------------------
// การแมปข้อมูลของแต่ละแหล่ง — ตรวจผ่าน List() เพราะฟังก์ชัน mapping ตัวจริงเป็น unexported ทดสอบตรงไม่ได้
// (แยกไฟล์นี้กับไฟล์ที่ทดสอบจริงคนละ package import path กัน แม้ชื่อ package จะเป็น "wms" เหมือนกัน)
// ---------------------------------------------------------------------------

func TestList_ProductAddedItem_MapsFields(t *testing.T) {
	repo := &mockMovementFeedRepo{
		listRecentProductsFn: func() ([]entity.Product, error) {
			return []entity.Product{{
				Model:        gorm.Model{ID: 1},
				Product_Code: "P-1",
				Product_Name: "Oil Filter",
				Quantity:     15,
			}}, nil
		},
	}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := mustFindByType(t, items, wmsDTO.MovementFeedProductAdded)
	if item.ProductCode != "P-1" || item.ProductName != "Oil Filter" {
		t.Errorf("unexpected product fields: %+v", item)
	}
	if item.Quantity == nil || *item.Quantity != 15 {
		t.Errorf("expected quantity 15, got %v", item.Quantity)
	}
}

func TestList_StockInItem_IncludesSupplierNameInDetail(t *testing.T) {
	repo := &mockMovementFeedRepo{
		listStockInMovementsFn: func() ([]entity.StockMovement, error) {
			return []entity.StockMovement{{
				Model:             gorm.Model{ID: 1},
				Movement_Type:     "IN",
				Quantity:          5,
				Movement_DateTime: time.Now(),
				Product:           &entity.Product{Product_Name: "Brake Pad", Product_Code: "P-2"},
				Supplier:          &entity.Supplier{SupplierName: "ABC Co."},
			}}, nil
		},
	}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := mustFindByType(t, items, wmsDTO.MovementFeedStockIn)
	if item.SupplierName != "ABC Co." {
		t.Errorf("expected supplier name ABC Co., got %q", item.SupplierName)
	}
	if item.Detail != "รับจาก ABC Co." {
		t.Errorf("expected detail to mention supplier, got %q", item.Detail)
	}
}

func TestList_StockAdjustedItem_ShowsExcessOrShortageInThai(t *testing.T) {
	tests := []struct {
		name       string
		diff       int
		wantSubstr string
	}{
		{"excess counted more than system", 5, "เกิน"},
		{"shortage counted less than system", -5, "ขาด"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &mockMovementFeedRepo{
				listStockAdjustmentsFn: func() ([]entity.CheckStock, error) {
					return []entity.CheckStock{{
						Model:               gorm.Model{ID: 1},
						Old_Quantity:        10,
						New_Quantity:        10 + tt.diff,
						Diff_Quantity:       tt.diff,
						Adjustment_DateTime: time.Now(),
						Product:             &entity.Product{Product_Name: "Turbo"},
					}}, nil
				},
			}
			svc := wmsService.NewMovementFeedService(repo)
			items, err := svc.List()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			item := mustFindByType(t, items, wmsDTO.MovementFeedStockAdjusted)
			if !strings.Contains(item.Detail, tt.wantSubstr) {
				t.Errorf("expected detail to contain %q, got %q", tt.wantSubstr, item.Detail)
			}
			if item.Quantity != nil {
				t.Errorf("expected stock-adjusted items not to set Quantity directly, got %v", item.Quantity)
			}
		})
	}
}

func TestList_SaleOutItem_TitleReflectsOrderStatus(t *testing.T) {
	tests := []struct {
		status    string
		wantTitle string
	}{
		{"completed", "ขายออก: Turbocharger"},
		{"pending", "รอดำเนินการ: Turbocharger"},
		{"cancelled", "ยกเลิกแล้ว: Turbocharger"},
	}
	for _, tt := range tests {
		t.Run(tt.status, func(t *testing.T) {
			repo := &mockMovementFeedRepo{
				listSaleOutItemsFn: func() ([]entity.SaleOrderItem, error) {
					return []entity.SaleOrderItem{{
						Model:       gorm.Model{ID: 1},
						OrderNumber: "SO-1",
						ProductID:   1,
						ProductName: "Turbocharger",
						Qty:         2,
						Order: entity.SaleOrder{
							Status:    enum.OrderStatus(tt.status),
							OrderDate: time.Now(),
						},
					}}, nil
				},
			}
			svc := wmsService.NewMovementFeedService(repo)
			items, err := svc.List()
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			item := mustFindByType(t, items, wmsDTO.MovementFeedSaleOut)
			if item.Title != tt.wantTitle {
				t.Errorf("expected title %q, got %q", tt.wantTitle, item.Title)
			}
			if item.Quantity == nil || *item.Quantity != -2 {
				t.Errorf("expected quantity -2 (outflow), got %v", item.Quantity)
			}
		})
	}
}

func TestList_ReturnItem_MapsFromStockMovement(t *testing.T) {
	repo := &mockMovementFeedRepo{
		listReturnMovementsFn: func() ([]entity.StockMovement, error) {
			return []entity.StockMovement{{
				Model:             gorm.Model{ID: 1},
				Quantity:          3,
				Movement_DateTime: time.Now(),
				Note:              "Return RET-001",
				Product:           &entity.Product{Product_Name: "Gasket Set"},
			}}, nil
		},
	}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := mustFindByType(t, items, wmsDTO.MovementFeedSalesReturn)
	if item.ProductName != "Gasket Set" || item.Detail != "Return RET-001" {
		t.Errorf("unexpected return item: %+v", item)
	}
}

func TestList_CustomerClaimItem_UsesClaimDateNotRowCreatedAt(t *testing.T) {
	rowCreatedAt := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	claimDate := time.Date(2026, 3, 15, 0, 0, 0, 0, time.UTC)

	repo := &mockMovementFeedRepo{
		listCustomerClaimItemsFn: func() ([]entity.CustomerClaimItem, error) {
			return []entity.CustomerClaimItem{{
				Model:     gorm.Model{ID: 1, CreatedAt: rowCreatedAt},
				ProductID: 1,
				Qty:       1,
				Reason:    "สินค้าชำรุด",
				Product:   &entity.Product{Product_Name: "LED Light"},
				CustomerClaim: &entity.CustomerClaim{
					ClaimNo:   "CLM-001",
					ClaimDate: claimDate,
				},
			}}, nil
		},
	}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := mustFindByType(t, items, wmsDTO.MovementFeedCustomerClaim)
	if !item.OccurredAt.Equal(claimDate) {
		t.Errorf("expected OccurredAt to use claim date %v, got %v", claimDate, item.OccurredAt)
	}
	if !strings.Contains(item.Detail, "CLM-001") || !strings.Contains(item.Detail, "สินค้าชำรุด") {
		t.Errorf("expected detail to mention claim number and reason, got %q", item.Detail)
	}
}

func TestList_PreOrderItem_FallsBackToSupplierSnapshotWhenPreOrderMissing(t *testing.T) {
	rowCreatedAt := time.Date(2026, 2, 1, 0, 0, 0, 0, time.UTC)
	repo := &mockMovementFeedRepo{
		listPreOrderItemsFn: func() ([]entity.PreOrderItem, error) {
			return []entity.PreOrderItem{{
				Model:               gorm.Model{ID: 1, CreatedAt: rowCreatedAt},
				ProductNameSnapshot: "Custom Bumper",
				ProductCodeSnapshot: "CUSTOM-1",
				SupplierName:        "Snapshot Supplier",
				Quantity:            4,
				PreOrder:            nil, // เผื่อกรณี preload ไม่เจอ ต้องไม่ panic และ fallback ไปใช้ค่า snapshot ของแถวเอง
			}}, nil
		},
	}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := mustFindByType(t, items, wmsDTO.MovementFeedPreOrder)
	if item.ProductName != "Custom Bumper" || item.SupplierName != "Snapshot Supplier" {
		t.Errorf("unexpected pre-order item: %+v", item)
	}
	if !item.OccurredAt.Equal(rowCreatedAt) {
		t.Errorf("expected fallback to row CreatedAt when PreOrder is nil, got %v", item.OccurredAt)
	}
}

func TestList_CheckFlaggedItem_UnknownCheckTypeFallsBackToRawValue(t *testing.T) {
	repo := &mockMovementFeedRepo{
		listCheckSchedulesFn: func() ([]entity.CheckStockSchedule, error) {
			return []entity.CheckStockSchedule{{
				Model:     gorm.Model{ID: 1},
				CheckType: "SOME_NEW_TYPE",
			}}, nil
		},
	}
	svc := wmsService.NewMovementFeedService(repo)
	items, err := svc.List()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	item := mustFindByType(t, items, wmsDTO.MovementFeedCheckFlagged)
	if !strings.Contains(item.Title, "SOME_NEW_TYPE") {
		t.Errorf("expected unknown check type to fall back to raw value in title, got %q", item.Title)
	}
}
