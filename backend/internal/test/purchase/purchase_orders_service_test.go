package purchase

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"
	"time"

	dto "backend/internal/app/dto/purchase_orders"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	preorder "backend/internal/app/repository/pre_oder"
	repo "backend/internal/app/repository/purchase_orders"
	"backend/internal/app/repository/wms"
	service "backend/internal/app/service/purchase_orders"
	"gorm.io/gorm"
)

// Unused embedded methods panic if called, so unexpected dependencies fail tests.
type mockPORepo struct {
	repo.PurchaseOrderRepository
	save    func(*entity.PO) error
	get     func(uint) (*entity.PO, error)
	reload  func(uint) (*entity.PO, error)
	update  func(*entity.PO) error
	delete  func(uint) error
	sync    func(uint, []entity.POItems) error
	status  func(uint, enum.POStatus, uint) error
	list    func(dto.ListPOQuery) ([]entity.PO, int64, error)
	years   func() ([]int, error)
	history func(int) ([]repo.POHistory, error)
	summary func() (*dto.POSummaryResponse, error)
}

func (m *mockPORepo) SavePO(_ context.Context, p *entity.PO) error             { return m.save(p) }
func (m *mockPORepo) GetPOByID(_ context.Context, id uint) (*entity.PO, error) { return m.get(id) }
func (m *mockPORepo) GetPOWithRelations(_ context.Context, id uint) (*entity.PO, error) {
	return m.reload(id)
}
func (m *mockPORepo) UpdatePO(_ context.Context, p *entity.PO) error { return m.update(p) }
func (m *mockPORepo) DeletePOByID(_ context.Context, id uint) error  { return m.delete(id) }
func (m *mockPORepo) SyncItems(_ context.Context, id uint, items []entity.POItems) error {
	return m.sync(id, items)
}
func (m *mockPORepo) UpdateStatus(_ context.Context, id uint, status enum.POStatus, user uint) error {
	return m.status(id, status, user)
}
func (m *mockPORepo) FindAll(_ context.Context, q dto.ListPOQuery) ([]entity.PO, int64, error) {
	return m.list(q)
}
func (m *mockPORepo) FindAvailableYears(context.Context) ([]int, error) { return m.years() }
func (m *mockPORepo) GetSupplierDeliveryHistory(_ context.Context, id int) ([]repo.POHistory, error) {
	return m.history(id)
}
func (m *mockPORepo) GetPOSummary(context.Context) (*dto.POSummaryResponse, error) {
	return m.summary()
}

type mockProduct struct {
	repo.ProductRepository
	get func(uint) (*entity.Product, error)
}

func (m *mockProduct) GetProductByID(_ context.Context, id uint) (*entity.Product, error) {
	return m.get(id)
}

type mockSupplier struct {
	repo.SupplierRepository
	get func(uint) (*entity.Supplier, error)
}

func (m *mockSupplier) GetSupplierByID(_ context.Context, id uint) (*entity.Supplier, error) {
	return m.get(id)
}

type mockUser struct {
	repo.UserRepository
	get func(uint) (*entity.User, error)
}

func (m *mockUser) FindByID(_ context.Context, id uint) (*entity.User, error) { return m.get(id) }

type mockPreorder struct {
	preorder.PreOrderRepository
	get    func(uint) (*entity.PreOrderItem, error)
	update func([]uint, string) error
}

func (m *mockPreorder) GetPreOrderItemByID(_ context.Context, id uint) (*entity.PreOrderItem, error) {
	return m.get(id)
}

func (m *mockPreorder) UpdateItemsStatusByIDs(_ context.Context, ids []uint, status string) error {
	return m.update(ids, status)
}

type mockAlerts struct {
	wms.StockAlertRepository
	resolve func([]uint) error
}

func (m *mockAlerts) ResolveByIDs(ids []uint) error { return m.resolve(ids) }

var _ repo.PurchaseOrderRepository = (*mockPORepo)(nil)

func ptr[T any](v T) *T { return &v }
func newService(r *mockPORepo) service.PurchaseOrderService {
	return service.NewPOService(r, nil, nil, nil, nil, nil, nil, nil)
}

func TestCreatePO_Success(t *testing.T) {
	for _, tc := range []struct {
		name   string
		links  []bool
		poType uint
		owner  bool
		status enum.POStatus
	}{
		{"purchase draft", []bool{false, false}, 1, false, enum.StatusDraft},
		{"preorder pending", []bool{true, true}, 2, false, enum.StatusPending},
		{"mixed owner approval", []bool{false, true}, 3, true, enum.StatusPending},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var saved *entity.PO
			r := &mockPORepo{}
			r.save = func(p *entity.PO) error { p.ID = 42; p.PO_number = "PO-TEST-00042"; saved = p; return nil }
			r.reload = func(id uint) (*entity.PO, error) {
				if id != 42 {
					t.Fatalf("reload ID = %d", id)
				}
				saved.Creator = entity.User{FirstName: "Test", LastName: "Creator"}
				saved.UpdatedByUser = &saved.Creator
				return saved, nil
			}
			products := &mockProduct{get: func(id uint) (*entity.Product, error) {
				p := &entity.Product{Product_Name: "Oil filter", Product_Code: "FALLBACK"}
				if id == 1 {
					p.Unit = &entity.Unit{Unit_Name: "piece"}
					p.Inventories = []entity.Inventory{{SupplierID: 99, CompanyProductCode: "WRONG"}, {SupplierID: 7, CompanyProductCode: "SUP-001"}}
				}
				return p, nil
			}}
			suppliers := &mockSupplier{get: func(id uint) (*entity.Supplier, error) {
				if id != 7 {
					t.Fatalf("supplier ID = %d", id)
				}
				return &entity.Supplier{SupplierName: "Supplier"}, nil
			}}
			users := &mockUser{get: func(id uint) (*entity.User, error) {
				if id != 9 {
					t.Fatalf("creator ID = %d", id)
				}
				u := &entity.User{}
				if tc.owner {
					u.Role.RoleName = enum.RoleOwner
				}
				return u, nil
			}}
			var reserved, resolved []uint
			pre := &mockPreorder{update: func(ids []uint, status string) error {
				if status != "RESERVED" {
					t.Fatalf("status = %s", status)
				}
				reserved = ids
				return nil
			}}
			alerts := &mockAlerts{resolve: func(ids []uint) error { resolved = ids; return nil }}
			req := &dto.CreatePurchaseOrderRequest{SupplierID: 7, Status: tc.status, Notes: ptr("order note")}
			var wantReserved []uint
			for i, linked := range tc.links {
				item := dto.POItemDTO{ProductID: uint(i + 1), Quantity: i + 2, UnitPrice: 12.5, Notes: ptr("item note"), AlertID: ptr(uint(i + 10))}
				if linked {
					item.PreOrderItemID = ptr(uint(i + 20))
					wantReserved = append(wantReserved, uint(i+20))
				}
				req.POItems = append(req.POItems, item)
			}
			before := time.Now()
			got, err := service.NewPOService(r, products, nil, suppliers, pre, users, alerts, nil).CreatePO(context.Background(), req, 9)
			if err != nil {
				t.Fatal(err)
			}
			if got.ID != 42 || got.PONumber != "PO-TEST-00042" || got.POTypeID != tc.poType || got.TotalAmount != 62.5 || saved.Total_amount != 62.5 {
				t.Fatalf("incorrect order: %+v", got)
			}
			if got.SupplierName != "Supplier" || got.CreatorName != "Test Creator" || got.CreatorID != 9 || got.SupplierID != 7 || *got.Notes != "order note" || *got.UpdatedByID != 9 || *got.UpdatedByName != "Test Creator" {
				t.Errorf("incorrect metadata: %+v", got)
			}
			if len(got.POItems) != 2 {
				t.Fatalf("items = %v", got.POItems)
			}
			for i, item := range got.POItems {
				wantSupplyCode, wantUnit, wantType := "", "", "สั่งซื้อ"
				if i == 0 {
					wantSupplyCode, wantUnit = "SUP-001", "piece"
				}
				if tc.links[i] {
					wantType = "พรีออเดอร์"
				}
				if item.ProductID != uint(i+1) || item.ProductNameSnapshot != "Oil filter" || item.ProductCodeSnapshot != "FALLBACK" || item.SupplyProductCodeSnapshot != wantSupplyCode || item.Unit != wantUnit || item.Quantity != i+2 || item.UnitPrice != 12.5 || item.SubTotal != float64(i+2)*12.5 || item.Notes != "item note" || item.OrderType != wantType || !reflect.DeepEqual(item.PreOrderItemID, req.POItems[i].PreOrderItemID) {
					t.Errorf("incorrect item: %+v", item)
				}
				if saved.PO_Items[i].ProductID == nil || *saved.PO_Items[i].ProductID != uint(i+1) {
					t.Errorf("saved product ID = %v, want %d", saved.PO_Items[i].ProductID, i+1)
				}
			}
			if !reflect.DeepEqual(reserved, wantReserved) {
				t.Errorf("reserved = %v, want %v", reserved, wantReserved)
			}
			if tc.owner {
				if got.Status != enum.StatusApproved || saved.Approved_by == nil || *saved.Approved_by != 9 || saved.Approved_at == nil || saved.Approved_at.Before(before) || saved.Approved_at.After(time.Now()) {
					t.Errorf("approval metadata: %+v", saved)
				}
				if len(resolved) != 0 {
					t.Errorf("PO approval must not resolve stock alerts before restocking: %v", resolved)
				}
			} else if got.Status != tc.status || saved.Approved_by != nil || saved.Approved_at != nil || len(resolved) != 0 {
				t.Errorf("unexpected approval: %+v", saved)
			}
		})
	}
}

func TestCreatePO_Errors(t *testing.T) {
	failure := errors.New("database unavailable")
	for _, stage := range []string{"supplier error", "supplier missing", "creator error", "product error", "product missing", "save error", "reload error"} {
		t.Run(stage, func(t *testing.T) {
			var calls []string
			r := &mockPORepo{save: func(p *entity.PO) error {
				calls = append(calls, "save")
				if stage == "save error" {
					return failure
				}
				p.ID = 1
				return nil
			}, reload: func(uint) (*entity.PO, error) { calls = append(calls, "reload"); return nil, failure }}
			s := &mockSupplier{get: func(uint) (*entity.Supplier, error) {
				calls = append(calls, "supplier")
				if stage == "supplier error" {
					return nil, failure
				}
				if stage == "supplier missing" {
					return nil, nil
				}
				return &entity.Supplier{}, nil
			}}
			u := &mockUser{get: func(uint) (*entity.User, error) {
				calls = append(calls, "creator")
				if stage == "creator error" {
					return nil, failure
				}
				return &entity.User{}, nil
			}}
			p := &mockProduct{get: func(uint) (*entity.Product, error) {
				calls = append(calls, "product")
				if stage == "product error" {
					return nil, failure
				}
				if stage == "product missing" {
					return nil, nil
				}
				return &entity.Product{}, nil
			}}
			got, err := service.NewPOService(r, p, nil, s, nil, u, nil, nil).CreatePO(context.Background(), &dto.CreatePurchaseOrderRequest{SupplierID: 7, Status: enum.StatusPending, POItems: []dto.POItemDTO{{ProductID: 3, Quantity: 1, UnitPrice: 10}}}, 9)
			if got != nil || err == nil {
				t.Fatalf("got %+v, error %v", got, err)
			}
			if strings.HasSuffix(stage, "missing") {
				if !strings.Contains(err.Error(), "not found") {
					t.Fatal(err)
				}
			} else if !errors.Is(err, failure) {
				t.Fatalf("lost original error: %v", err)
			}
			want := []string{"supplier", "creator", "product", "save", "reload"}
			last := strings.Fields(stage)[0]
			for i, call := range want {
				if call == last {
					want = want[:i+1]
					break
				}
			}
			if !reflect.DeepEqual(calls, want) {
				t.Errorf("calls = %v, want %v", calls, want)
			}
		})
	}
}

func TestPO_MutationGuards(t *testing.T) {
	failure := errors.New("read failed")
	for _, tc := range []struct {
		name          string
		status        enum.POStatus
		readErr, want error
	}{
		{"not found", enum.StatusDraft, gorm.ErrRecordNotFound, service.ErrPONotFound},
		{"repository error", enum.StatusDraft, failure, failure},
		{"approved", enum.StatusApproved, nil, service.ErrPOCannotUpdate},
	} {
		for _, op := range []string{"update", "status", "delete"} {
			t.Run(op+"/"+tc.name, func(t *testing.T) {
				r := &mockPORepo{get: func(id uint) (*entity.PO, error) {
					if id != 42 {
						t.Fatalf("ID = %d", id)
					}
					return &entity.PO{Status: tc.status}, tc.readErr
				}}
				s := newService(r)
				var err error
				want := tc.want
				switch op {
				case "update":
					_, err = s.UpdatePO(context.Background(), 42, &dto.UpdatePurchaseOrderRequest{}, 9, string(enum.RoleOwner))
				case "status":
					err = s.UpdatePOStatus(context.Background(), 42, enum.StatusPending, 9, string(enum.RoleOwner))
				case "delete":
					err = s.Delete(context.Background(), 42)
					if tc.status == enum.StatusApproved {
						want = service.ErrPOCannotDelete
					}
				}
				if !errors.Is(err, want) {
					t.Fatalf("error = %v, want %v", err, want)
				}
			})
		}
	}
}

func TestDeletePO_ReleasesPreordersOnlyAfterSuccessfulDelete(t *testing.T) {
	failure := errors.New("delete failed")
	for _, fail := range []bool{false, true} {
		t.Run(map[bool]string{false: "success", true: "repository error"}[fail], func(t *testing.T) {
			var calls []string
			r := &mockPORepo{get: func(uint) (*entity.PO, error) {
				return &entity.PO{Status: enum.StatusDraft, PO_Items: []entity.POItems{{PreOrderItemID: ptr(uint(20))}, {}}}, nil
			}, delete: func(id uint) error {
				if id != 42 {
					t.Fatalf("ID = %d", id)
				}
				calls = append(calls, "delete")
				if fail {
					return failure
				}
				return nil
			}}
			pre := &mockPreorder{update: func(ids []uint, status string) error {
				if !reflect.DeepEqual(ids, []uint{20}) || status != "PENDING" {
					t.Fatalf("release = %v %s", ids, status)
				}
				calls = append(calls, "release")
				return nil
			}}
			err := service.NewPOService(r, nil, nil, nil, pre, nil, nil, nil).Delete(context.Background(), 42)
			want := []string{"delete", "release"}
			if fail {
				want = want[:1]
				if !errors.Is(err, failure) {
					t.Fatal(err)
				}
			} else if err != nil {
				t.Fatal(err)
			}
			if !reflect.DeepEqual(calls, want) {
				t.Errorf("calls = %v", calls)
			}
		})
	}
}

func TestUpdatePO_RecalculatesItemsAndPreorderReservations(t *testing.T) {
	for _, status := range []enum.POStatus{enum.StatusDraft, enum.StatusPending, enum.StatusResubmitted} {
		t.Run(string(status), func(t *testing.T) {
			po := &entity.PO{Model: gorm.Model{ID: 42}, Status: status, SupplierID: 7, PO_Items: []entity.POItems{{PreOrderItemID: ptr(uint(20))}, {PreOrderItemID: ptr(uint(21))}}}
			updates := 0
			var synced []entity.POItems
			var reservations []string
			r := &mockPORepo{get: func(uint) (*entity.PO, error) { return po, nil }, update: func(p *entity.PO) error {
				updates++
				if p.LastUpdatedBy == nil || *p.LastUpdatedBy != 9 {
					t.Fatal("missing editor")
				}
				return nil
			}, sync: func(id uint, items []entity.POItems) error {
				if id != 42 {
					t.Fatal(id)
				}
				synced = items
				return nil
			}, reload: func(uint) (*entity.PO, error) { return po, nil }}
			pre := &mockPreorder{update: func(ids []uint, s string) error {
				want := []uint{20}
				if s == "RESERVED" {
					want = []uint{22}
				}
				if !reflect.DeepEqual(ids, want) {
					t.Fatalf("IDs = %v", ids)
				}
				reservations = append(reservations, s)
				return nil
			}}
			products := &mockProduct{get: func(uint) (*entity.Product, error) {
				return &entity.Product{Product_Name: "Filter", Product_Code: "P001", Unit: &entity.Unit{Unit_Name: "piece"}}, nil
			}}
			req := &dto.UpdatePurchaseOrderRequest{Notes: ptr("edited"), Items: []dto.UpdatePOItemRequest{{ID: ptr(uint(100)), ProductID: 1, Quantity: 2, UnitPrice: 12.5, PreOrderItemID: ptr(uint(21))}, {ProductID: 1, Quantity: 3, UnitPrice: 10, PreOrderItemID: ptr(uint(22))}, {ProductID: 1, Quantity: 1.5, UnitPrice: 20, AlertID: ptr(uint(5))}}}
			got, err := service.NewPOService(r, products, nil, nil, pre, nil, nil, nil).UpdatePO(context.Background(), 42, req, 9, string(enum.RoleOwner))
			if err != nil {
				t.Fatal(err)
			}
			if got.Total_amount != 85 || got.PO_type_id != 3 || *got.Notes != "edited" || got.Status != status || updates == 0 {
				t.Fatalf("updated PO = %+v", got)
			}
			if len(synced) != 3 {
				t.Fatalf("synced = %v", synced)
			}
			if synced[0].ID != 100 || synced[0].SubTotal != 25 || synced[0].Product_name_snapshot != "Filter" || synced[0].Product_code_snapshot != "P001" || synced[0].Supply_product_code_snapshot != "" || synced[0].Unit != "piece" || synced[2].Quantity != 1.5 || *synced[2].AlertID != 5 {
				t.Errorf("synced items = %+v", synced)
			}
			if !reflect.DeepEqual(reservations, []string{"PENDING", "RESERVED"}) {
				t.Errorf("reservations = %v", reservations)
			}
		})
	}
}

func TestUpdatePOStatus(t *testing.T) {
	for _, target := range []enum.POStatus{enum.StatusPending, enum.StatusApproved, enum.StatusResubmitted, enum.StatusCancelled} {
		for _, fail := range []bool{false, true} {
			t.Run(string(target)+map[bool]string{false: "/success", true: "/write error"}[fail], func(t *testing.T) {
				failure := errors.New("status write failed")
				currentStatus := enum.StatusDraft
				if target == enum.StatusResubmitted || target == enum.StatusCancelled {
					currentStatus = enum.StatusPending
				}
				po := &entity.PO{Model: gorm.Model{ID: 42}, Status: currentStatus, PO_Items: []entity.POItems{{PreOrderItemID: ptr(uint(20)), AlertID: ptr(uint(10))}, {}}}
				writes, releases, resolves := 0, 0, 0
				r := &mockPORepo{get: func(uint) (*entity.PO, error) { return po, nil }}
				r.update = func(p *entity.PO) error {
					writes++
					if p.Status != target || p.LastUpdatedBy == nil || *p.LastUpdatedBy != 9 {
						t.Fatalf("updated PO = %+v", p)
					}
					if target == enum.StatusApproved && (p.Approved_by == nil || *p.Approved_by != 9 || p.Approved_at == nil) {
						t.Fatal("missing approval metadata")
					}
					if fail {
						return failure
					}
					return nil
				}
				r.status = func(id uint, status enum.POStatus, user uint) error {
					writes++
					if id != 42 || status != target || user != 9 {
						t.Fatalf("status arguments = %d %s %d", id, status, user)
					}
					if fail {
						return failure
					}
					return nil
				}
				pre := &mockPreorder{update: func(ids []uint, status string) error {
					releases++
					if !reflect.DeepEqual(ids, []uint{20}) || status != "PENDING" {
						t.Fatalf("release = %v %s", ids, status)
					}
					return nil
				}}
				alerts := &mockAlerts{resolve: func(ids []uint) error {
					resolves++
					if !reflect.DeepEqual(ids, []uint{10}) {
						t.Fatal(ids)
					}
					return nil
				}}
				err := service.NewPOService(r, nil, nil, nil, pre, nil, alerts, nil).UpdatePOStatus(context.Background(), 42, target, 9, string(enum.RoleOwner))
				if fail {
					if !errors.Is(err, failure) {
						t.Fatal(err)
					}
				} else if err != nil {
					t.Fatal(err)
				}
				if writes != 1 {
					t.Fatalf("writes = %d", writes)
				}
				if !fail {
					wantReleases, wantResolves := 0, 0
					if target == enum.StatusCancelled || target == enum.StatusResubmitted {
						wantReleases = 1
					}
					if releases != wantReleases || resolves != wantResolves {
						t.Fatalf("releases = %d, resolves = %d", releases, resolves)
					}
				}
			})
		}
	}
}

func TestPORoleAndStatusGuards(t *testing.T) {
	for _, tc := range []struct {
		name       string
		current    enum.POStatus
		target     enum.POStatus
		role       string
		wantErr    error
		wantWrites int
	}{
		{"owner approves pending", enum.StatusPending, enum.StatusApproved, "Owner", nil, 1},
		{"employee submits draft", enum.StatusDraft, enum.StatusPending, "Employee", nil, 1},
		{"employee cannot approve", enum.StatusPending, enum.StatusApproved, "Employee", service.ErrPOForbidden, 0},
		{"manager cannot cancel", enum.StatusPending, enum.StatusCancelled, "Manager", service.ErrPOForbidden, 0},
		{"cancelled cannot be resubmitted", enum.StatusCancelled, enum.StatusPending, "Employee", service.ErrPOCannotUpdate, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			writes := 0
			po := &entity.PO{Model: gorm.Model{ID: 42}, Status: tc.current}
			r := &mockPORepo{
				get: func(uint) (*entity.PO, error) { return po, nil },
				update: func(*entity.PO) error {
					writes++
					return nil
				},
				status: func(uint, enum.POStatus, uint) error {
					writes++
					return nil
				},
			}
			err := newService(r).UpdatePOStatus(context.Background(), 42, tc.target, 9, tc.role)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("error=%v, want %v", err, tc.wantErr)
			}
			if writes != tc.wantWrites {
				t.Fatalf("writes=%d, want %d", writes, tc.wantWrites)
			}
		})
	}

	t.Run("employee cannot edit pending PO", func(t *testing.T) {
		r := &mockPORepo{get: func(uint) (*entity.PO, error) {
			return &entity.PO{Model: gorm.Model{ID: 42}, Status: enum.StatusPending}, nil
		}}
		_, err := newService(r).UpdatePO(context.Background(), 42, &dto.UpdatePurchaseOrderRequest{}, 9, "Employee")
		if !errors.Is(err, service.ErrPOForbidden) {
			t.Fatalf("error=%v, want %v", err, service.ErrPOForbidden)
		}
	})

	t.Run("pending PO cannot be deleted", func(t *testing.T) {
		r := &mockPORepo{get: func(uint) (*entity.PO, error) {
			return &entity.PO{Model: gorm.Model{ID: 42}, Status: enum.StatusPending}, nil
		}}
		if err := newService(r).Delete(context.Background(), 42); !errors.Is(err, service.ErrPOCannotDelete) {
			t.Fatalf("error=%v, want %v", err, service.ErrPOCannotDelete)
		}
	})
}

func TestUpdatePO_Errors(t *testing.T) {
	for _, stage := range []string{"first update", "product error", "product missing", "sync", "final update", "reload"} {
		t.Run(stage, func(t *testing.T) {
			failure := errors.New("write failed")
			updates, syncs, reloads := 0, 0, 0
			po := &entity.PO{Model: gorm.Model{ID: 42}, Status: enum.StatusDraft}
			r := &mockPORepo{get: func(uint) (*entity.PO, error) { return po, nil }}
			r.update = func(*entity.PO) error {
				updates++
				if (stage == "first update" && updates == 1) || (stage == "final update" && updates == 2) {
					return failure
				}
				return nil
			}
			r.sync = func(uint, []entity.POItems) error {
				syncs++
				if stage == "sync" {
					return failure
				}
				return nil
			}
			r.reload = func(uint) (*entity.PO, error) { reloads++; return nil, failure }
			products := &mockProduct{get: func(uint) (*entity.Product, error) {
				if stage == "product error" {
					return nil, failure
				}
				if stage == "product missing" {
					return nil, nil
				}
				return &entity.Product{}, nil
			}}
			got, err := service.NewPOService(r, products, nil, nil, nil, nil, nil, nil).UpdatePO(context.Background(), 42, &dto.UpdatePurchaseOrderRequest{Items: []dto.UpdatePOItemRequest{{ProductID: 3, Quantity: 1, UnitPrice: 10}}}, 9, string(enum.RoleOwner))
			if got != nil || err == nil {
				t.Fatalf("got %+v, %v", got, err)
			}
			if strings.HasPrefix(stage, "product") {
				if !strings.Contains(err.Error(), "failed to find product ID 3") {
					t.Fatal(err)
				}
			} else if !errors.Is(err, failure) {
				t.Fatal(err)
			}
			wantUpdates, wantSyncs, wantReloads := 1, 0, 0
			if strings.HasPrefix(stage, "product") {
				wantUpdates = 0
			}
			if stage == "sync" || stage == "final update" || stage == "reload" {
				wantSyncs = 1
			}
			if stage == "final update" || stage == "reload" {
				wantUpdates = 2
			}
			if stage == "reload" {
				wantReloads = 1
			}
			if updates != wantUpdates || syncs != wantSyncs || reloads != wantReloads {
				t.Fatalf("updates=%d syncs=%d reloads=%d", updates, syncs, reloads)
			}
		})
	}
}

func TestUpdatePO_OmittedItemsPreserveExistingOrder(t *testing.T) {
	items := []entity.POItems{{ProductID: ptr(uint(3)), Quantity: 2, UnitPrice: 10, SubTotal: 20}}
	po := &entity.PO{Model: gorm.Model{ID: 42}, Status: enum.StatusDraft, SupplierID: 7, PO_type_id: 1, Total_amount: 20, PO_Items: items}
	r := &mockPORepo{get: func(uint) (*entity.PO, error) { return po, nil }, update: func(*entity.PO) error { return nil }, reload: func(uint) (*entity.PO, error) { return po, nil }}
	got, err := newService(r).UpdatePO(context.Background(), 42, &dto.UpdatePurchaseOrderRequest{Notes: ptr("changed")}, 9, string(enum.RoleOwner))
	if err != nil {
		t.Fatal(err)
	}
	if got.SupplierID != 7 || got.PO_type_id != 1 || got.Total_amount != 20 || !reflect.DeepEqual(got.PO_Items, items) || *got.Notes != "changed" {
		t.Fatalf("unexpected update: %+v", got)
	}
}

func TestGetPOByID_AndList(t *testing.T) {
	po := entity.PO{Model: gorm.Model{ID: 42}, PO_number: "PO-42", SupplierID: 7, Supplier: entity.Supplier{Model: gorm.Model{ID: 7}, SupplierName: "Supplier"}, Creator: entity.User{Model: gorm.Model{ID: 9}, FirstName: "Test", LastName: "User"}, Total_amount: 25, PO_Items: []entity.POItems{{ProductID: ptr(uint(1)), Product_name_snapshot: "Filter", Quantity: 2, UnitPrice: 12.5, SubTotal: 25, Notes: ptr("note"), PreOrderItemID: ptr(uint(20))}}}
	r := &mockPORepo{reload: func(id uint) (*entity.PO, error) {
		if id != 42 {
			t.Fatal(id)
		}
		return &po, nil
	}}
	got, err := newService(r).GetPOByID(context.Background(), 42)
	if err != nil {
		t.Fatal(err)
	}
	if got.ID != 42 || got.SupplierName != "Supplier" || got.CreatorName != "Test User" || len(got.POItems) != 1 {
		t.Fatalf("response = %+v", got)
	}
	if got.POItems[0].OrderType != "พรีออเดอร์" || got.POItems[0].Notes != "note" || got.POItems[0].SubTotal != 25 {
		t.Errorf("item = %+v", got.POItems[0])
	}
	query := dto.ListPOQuery{Page: 2, Limit: 10, Status: "PENDING", Search: "PO", Year: "2026", Month: "09"}
	r.list = func(q dto.ListPOQuery) ([]entity.PO, int64, error) {
		if q != query {
			t.Errorf("query = %+v", q)
		}
		return []entity.PO{po}, 21, nil
	}
	list, err := newService(r).ListPOs(context.Background(), query)
	if err != nil {
		t.Fatal(err)
	}
	if list.Total != 21 || len(list.Data) != 1 || list.Data[0].PONumber != "PO-42" || list.Data[0].TotalAmount != 25 || list.Data[0].SupplierName != "Supplier" {
		t.Errorf("list = %+v", list)
	}
}

func TestPO_ReadErrors(t *testing.T) {
	failure := errors.New("read failed")
	for _, readErr := range []error{gorm.ErrRecordNotFound, failure} {
		t.Run(readErr.Error(), func(t *testing.T) {
			r := &mockPORepo{reload: func(uint) (*entity.PO, error) { return nil, readErr }, list: func(dto.ListPOQuery) ([]entity.PO, int64, error) { return nil, 0, readErr }}
			want := readErr
			if errors.Is(readErr, gorm.ErrRecordNotFound) {
				want = service.ErrPONotFound
			}
			if got, err := newService(r).GetPOByID(context.Background(), 42); got != nil || !errors.Is(err, want) {
				t.Fatalf("get = %+v, %v", got, err)
			}
			if got, err := newService(r).ListPOs(context.Background(), dto.ListPOQuery{}); got != nil || !errors.Is(err, readErr) {
				t.Fatalf("list = %+v, %v", got, err)
			}
		})
	}
}

func TestGetAvailableYears(t *testing.T) {
	year := time.Now().Year()
	failure := errors.New("years failed")
	for _, tc := range []struct {
		name        string
		years, want []int
		err         error
	}{{"empty", nil, []int{year}, nil}, {"prepend current", []int{year - 1}, []int{year, year - 1}, nil}, {"no duplicate", []int{year, year - 1}, []int{year, year - 1}, nil}, {"error", nil, nil, failure}} {
		t.Run(tc.name, func(t *testing.T) {
			r := &mockPORepo{years: func() ([]int, error) { return tc.years, tc.err }}
			got, err := newService(r).GetAvailableYears(context.Background())
			if !errors.Is(err, tc.err) || !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got %v, %v", got, err)
			}
		})
	}
}

func TestGetPOSummary_AccessAndErrors(t *testing.T) {
	for _, role := range []string{"Owner", "owner", "OWNER", "Employee", ""} {
		t.Run(role, func(t *testing.T) {
			called := false
			want := &dto.POSummaryResponse{MonthlyApprovedCount: 12}
			r := &mockPORepo{summary: func() (*dto.POSummaryResponse, error) { called = true; return want, nil }}
			got, err := newService(r).GetPOSummary(context.Background(), role)
			if strings.EqualFold(role, "Owner") {
				if err != nil || got != want || !called {
					t.Fatalf("got %+v, %v", got, err)
				}
			} else if err == nil || got != nil || called {
				t.Fatalf("unauthorized summary: %+v, %v, called=%v", got, err, called)
			}
		})
	}
	failure := errors.New("summary failed")
	r := &mockPORepo{summary: func() (*dto.POSummaryResponse, error) { return nil, failure }}
	if _, err := newService(r).GetPOSummary(context.Background(), "Owner"); !errors.Is(err, failure) {
		t.Fatal(err)
	}
}
