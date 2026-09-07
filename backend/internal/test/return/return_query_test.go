package returns_test

import (
	"errors"
	"reflect"
	"testing"
	"time"

	returnDTO "backend/internal/app/dto/return"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	returnService "backend/internal/app/service/return"

	"gorm.io/gorm"
)

func TestReturnService_GetReturns_PaginationAndStatusCounts(t *testing.T) {
	for _, tt := range []struct {
		name       string
		request    returnDTO.GetReturnsRequest
		page       int
		pageSize   int
		offset     int
		totalCount int64
	}{
		{name: "zero values use defaults", page: 1, pageSize: 10, totalCount: 13},
		{name: "negative values use defaults", request: returnDTO.GetReturnsRequest{Page: -2, PageSize: -5}, page: 1, pageSize: 10, totalCount: 13},
		{name: "default page preserves page size", request: returnDTO.GetReturnsRequest{Page: -1, PageSize: 4}, page: 1, pageSize: 4, totalCount: 13},
		{name: "default page size preserves page", request: returnDTO.GetReturnsRequest{Page: 3}, page: 3, pageSize: 10, offset: 20, totalCount: 13},
		{name: "custom pagination", request: returnDTO.GetReturnsRequest{Page: 3, PageSize: 4}, page: 3, pageSize: 4, offset: 8, totalCount: 13},
		{name: "pending filter", request: returnDTO.GetReturnsRequest{Status: "PENDING"}, page: 1, pageSize: 10, totalCount: 4},
		{name: "approved filter", request: returnDTO.GetReturnsRequest{Status: "APPROVED"}, page: 1, pageSize: 10, totalCount: 4},
		{name: "refunded filter", request: returnDTO.GetReturnsRequest{Status: "REFUNDED"}, page: 1, pageSize: 10, totalCount: 4},
		{name: "rejected filter", request: returnDTO.GetReturnsRequest{Status: "REJECTED"}, page: 1, pageSize: 10, totalCount: 4},
	} {
		t.Run(tt.name, func(t *testing.T) {
			tt.request.Search = "RET-2026"
			repo := newMockReturnRepo(t)
			repo.getStatusCountsFn = func(search string) ([]returnDTO.ReturnStatusCount, error) {
				if search != tt.request.Search {
					t.Fatalf("count search = %q, want %q", search, tt.request.Search)
				}
				return []returnDTO.ReturnStatusCount{
					{Status: enum.ReturnRefunded, Count: 2},
					{Status: enum.ReturnApproved, Count: 7},
					{Status: enum.ReturnPending, Count: 4},
				}, nil
			}
			repo.getListFn = func(search, status string, limit, offset int) ([]entity.SalesReturn, int64, error) {
				if search != tt.request.Search || status != tt.request.Status || limit != tt.pageSize || offset != tt.offset {
					t.Fatalf("GetList(%q, %q, %d, %d), want (%q, %q, %d, %d)", search, status, limit, offset, tt.request.Search, tt.request.Status, tt.pageSize, tt.offset)
				}
				return nil, 4, nil
			}

			got, err := returnService.NewReturnService(repo).GetReturns(tt.request)
			if err != nil {
				t.Fatal(err)
			}
			want := &returnDTO.GetReturnsResponse{
				Data: []returnDTO.ReturnListItem{},
				StatusCounts: []returnDTO.ReturnStatusCount{
					{Status: enum.ReturnPending, Count: 4},
					{Status: enum.ReturnApproved, Count: 7},
					{Status: enum.ReturnRefunded, Count: 2},
					{Status: enum.ReturnRejected, Count: 0},
				},
				TotalCount: tt.totalCount, Page: tt.page, PageSize: tt.pageSize,
			}
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("GetReturns() = %+v, want %+v", got, want)
			}
			if repo.called["GetStatusCounts"] != 1 || repo.called["GetList"] != 1 {
				t.Fatalf("repository calls = %v, want one count and one list call", repo.called)
			}
		})
	}
}

func TestReturnService_GetReturns_InvalidStatus(t *testing.T) {
	for _, status := range []string{"UNKNOWN", "pending", " APPROVED ", " "} {
		t.Run(status, func(t *testing.T) {
			repo := newMockReturnRepo(t)
			got, err := returnService.NewReturnService(repo).GetReturns(returnDTO.GetReturnsRequest{Status: status})
			if err == nil || err.Error() != "invalid status" || got != nil {
				t.Fatalf("GetReturns() = (%+v, %v), want nil response and invalid status", got, err)
			}
			if len(repo.called) != 0 {
				t.Fatalf("invalid status called repository: %v", repo.called)
			}
		})
	}
}

func TestReturnService_GetReturns_RepositoryErrors(t *testing.T) {
	for _, failure := range []string{"GetStatusCounts", "GetList"} {
		t.Run(failure, func(t *testing.T) {
			wantErr := errors.New("repository unavailable")
			repo := newMockReturnRepo(t)
			repo.getStatusCountsFn = func(string) ([]returnDTO.ReturnStatusCount, error) {
				if failure == "GetStatusCounts" {
					return nil, wantErr
				}
				return nil, nil
			}
			if failure == "GetList" {
				repo.getListFn = func(string, string, int, int) ([]entity.SalesReturn, int64, error) {
					return nil, 0, wantErr
				}
			}
			got, err := returnService.NewReturnService(repo).GetReturns(returnDTO.GetReturnsRequest{})
			if !errors.Is(err, wantErr) || got != nil {
				t.Fatalf("GetReturns() = (%+v, %v), want (nil, %v)", got, err, wantErr)
			}
			if repo.called["GetStatusCounts"] != 1 || (failure == "GetStatusCounts" && repo.called["GetList"] != 0) {
				t.Fatalf("unexpected repository calls: %v", repo.called)
			}
		})
	}
}

func TestReturnService_GetReturns_MapsListItems(t *testing.T) {
	requested := time.Date(2026, 9, 7, 9, 10, 11, 0, time.FixedZone("ICT", 7*60*60))
	approved := requested.Add(time.Hour)
	refunded := approved.Add(time.Hour)
	approvedText, refundedText := "2026-09-07 10:10:11", "2026-09-07 11:10:11"
	rows := []entity.SalesReturn{
		{
			Model: gorm.Model{ID: 11}, ReturnNumber: "RET-011", OriginalOrderID: 42,
			Status: enum.ReturnRefunded, Reason: "Wrong part", RefundAmount: 500.25,
			RefundMethod: "cash", RequestedAt: requested, ApprovedAt: &approved,
			RefundedAt: &refunded, Note: "Inspected",
		},
		{Model: gorm.Model{ID: 12}, ReturnNumber: "RET-012", Status: enum.ReturnPending, RequestedAt: requested},
	}
	repo := newMockReturnRepo(t)
	repo.getStatusCountsFn = func(string) ([]returnDTO.ReturnStatusCount, error) { return nil, nil }
	repo.getListFn = func(string, string, int, int) ([]entity.SalesReturn, int64, error) { return rows, 2, nil }
	got, err := returnService.NewReturnService(repo).GetReturns(returnDTO.GetReturnsRequest{})
	if err != nil {
		t.Fatal(err)
	}
	wantItems := []returnDTO.ReturnListItem{
		{
			ID: 11, ReturnNumber: "RET-011", OriginalOrderID: 42, Status: enum.ReturnRefunded,
			Reason: "Wrong part", RefundAmount: 500.25, RefundMethod: "cash",
			RequestedAt: "2026-09-07 09:10:11", ApprovedAt: &approvedText, RefundedAt: &refundedText, Note: "Inspected",
		},
		{ID: 12, ReturnNumber: "RET-012", Status: enum.ReturnPending, RequestedAt: "2026-09-07 09:10:11"},
	}
	if !reflect.DeepEqual(got.Data, wantItems) {
		t.Fatalf("list items = %+v, want %+v", got.Data, wantItems)
	}
	wantCounts := []returnDTO.ReturnStatusCount{
		{Status: enum.ReturnPending}, {Status: enum.ReturnApproved},
		{Status: enum.ReturnRefunded}, {Status: enum.ReturnRejected},
	}
	if !reflect.DeepEqual(got.StatusCounts, wantCounts) {
		t.Fatalf("empty status counts = %+v, want %+v", got.StatusCounts, wantCounts)
	}
}

func TestReturnService_SearchReturnableSaleOrders_Mapping(t *testing.T) {
	orderedAt := time.Date(2026, 9, 6, 14, 30, 0, 0, time.FixedZone("ICT", 7*60*60))
	createdAt := time.Date(2026, 9, 5, 8, 15, 0, 0, time.UTC)
	customerID := uint(8)
	temporaryName, emptyName := "Walk-in customer", ""
	orders := []entity.SaleOrder{
		{
			Model: gorm.Model{ID: 41, CreatedAt: createdAt}, OrderNumber: "SO-041", OrderDate: orderedAt,
			CustomerID: &customerID, Customer: entity.Customer{CustomerName: "Registered customer"}, CustomerNameTemp: &temporaryName,
			CreatedBy: &entity.User{FirstName: "Somchai", LastName: "Jaidee", Username: "cashier"},
			Items: []entity.SaleOrderItem{{
				ProductID: 10, PartNumber: "SOLD-PART", ProductName: "Sold product", Qty: 2,
				FinalUnitPrice: 75.25, UnitPrice: 100,
				Product: entity.Product{Product_Code: "CURRENT-PART", Product_Name: "Current product"},
			}},
		},
		{
			Model: gorm.Model{ID: 42, CreatedAt: createdAt}, OrderNumber: "SO-042",
			CustomerNameTemp: &temporaryName, CreatedBy: &entity.User{Username: "cashier"},
			Items: []entity.SaleOrderItem{
				{ProductID: 11, Qty: 3, UnitPrice: 125.5, Product: entity.Product{Product_Code: "PART-11", Product_Name: "Brake pad"}},
				{ProductID: 12, Qty: 1, FinalUnitPrice: -1, UnitPrice: 50},
				{ProductID: 13, PartNumber: "SOLD-CODE", Qty: 1, UnitPrice: 30, Product: entity.Product{Product_Code: "NEW-CODE", Product_Name: "Current name"}},
				{ProductID: 14, ProductName: "Sold name", Qty: 1, UnitPrice: 40, Product: entity.Product{Product_Code: "CURRENT-CODE", Product_Name: "New name"}},
			},
		},
		{Model: gorm.Model{ID: 43, CreatedAt: createdAt}},
		{Model: gorm.Model{ID: 44, CreatedAt: createdAt}, CustomerNameTemp: &emptyName, CreatedBy: &entity.User{}},
		{Model: gorm.Model{ID: 45, CreatedAt: createdAt}, CreatedBy: &entity.User{FirstName: "Somchai", Username: "cashier"}},
	}
	repo := newMockReturnRepo(t)
	repo.searchOrdersFn = func(keyword string) ([]entity.SaleOrder, error) {
		if keyword != "SO-04" {
			t.Fatalf("search keyword = %q, want SO-04", keyword)
		}
		return orders, nil
	}
	got, err := returnService.NewReturnService(repo).SearchReturnableSaleOrders("SO-04")
	if err != nil {
		t.Fatal(err)
	}
	want := []returnDTO.ReturnableSaleOrderDTO{
		{
			ID: 41, OrderNumber: "SO-041", SoldAt: "2026-09-06T14:30:00+07:00", CustomerID: &customerID,
			CustomerName: "Registered customer", EmployeeName: "Somchai Jaidee",
			Items: []returnDTO.ReturnableSaleOrderItemDTO{{ProductID: 10, ProductName: "Sold product", ProductCode: "SOLD-PART", Quantity: 2, UnitPrice: 75.25}},
		},
		{
			ID: 42, OrderNumber: "SO-042", SoldAt: "2026-09-05T08:15:00Z", CustomerName: "Walk-in customer", EmployeeName: "cashier",
			Items: []returnDTO.ReturnableSaleOrderItemDTO{
				{ProductID: 11, ProductName: "Brake pad", ProductCode: "PART-11", Quantity: 3, UnitPrice: 125.5},
				{ProductID: 12, Quantity: 1, UnitPrice: 50},
				{ProductID: 13, ProductName: "Current name", ProductCode: "SOLD-CODE", Quantity: 1, UnitPrice: 30},
				{ProductID: 14, ProductName: "Sold name", ProductCode: "CURRENT-CODE", Quantity: 1, UnitPrice: 40},
			},
		},
		{ID: 43, SoldAt: "2026-09-05T08:15:00Z", CustomerName: "ไม่ระบุ", EmployeeName: "ไม่ระบุ", Items: []returnDTO.ReturnableSaleOrderItemDTO{}},
		{ID: 44, SoldAt: "2026-09-05T08:15:00Z", CustomerName: "ไม่ระบุ", EmployeeName: "ไม่ระบุ", Items: []returnDTO.ReturnableSaleOrderItemDTO{}},
		{ID: 45, SoldAt: "2026-09-05T08:15:00Z", CustomerName: "ไม่ระบุ", EmployeeName: "Somchai", Items: []returnDTO.ReturnableSaleOrderItemDTO{}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("search results = %+v, want %+v", got, want)
	}
	if repo.called["SearchReturnableSaleOrders"] != 1 {
		t.Fatalf("repository calls = %v, want one search", repo.called)
	}
}

func TestReturnService_SearchReturnableSaleOrders_EmptyAndError(t *testing.T) {
	wantErr := errors.New("search unavailable")
	for _, tt := range []struct {
		name   string
		orders []entity.SaleOrder
		err    error
	}{
		{name: "nil results"},
		{name: "empty results", orders: []entity.SaleOrder{}},
		{name: "repository error", err: wantErr},
	} {
		t.Run(tt.name, func(t *testing.T) {
			repo := newMockReturnRepo(t)
			repo.searchOrdersFn = func(string) ([]entity.SaleOrder, error) { return tt.orders, tt.err }
			got, err := returnService.NewReturnService(repo).SearchReturnableSaleOrders("")
			if !errors.Is(err, tt.err) {
				t.Fatalf("error = %v, want %v", err, tt.err)
			}
			if tt.err != nil {
				if got != nil {
					t.Fatalf("error response = %+v, want nil", got)
				}
			} else if got == nil || len(got) != 0 {
				t.Fatalf("empty response = %+v, want non-nil empty slice", got)
			}
		})
	}
}

func TestReturnService_GetReturnByID_MapsDetail(t *testing.T) {
	now := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
	approverID, refunderID := uint(7), uint(9)
	order := &entity.SaleOrder{Model: gorm.Model{ID: 41}, OrderNumber: "SO-041"}
	creator := &entity.User{Model: gorm.Model{ID: 5}, Username: "cashier"}
	approver := &entity.User{Model: gorm.Model{ID: approverID}, Username: "owner"}
	row := &entity.SalesReturn{
		Model: gorm.Model{ID: 11, CreatedAt: now, UpdatedAt: now}, ReturnNumber: "RET-011",
		OriginalOrderID: 41, OriginalOrder: order, ReturnDate: now, Status: enum.ReturnRefunded,
		Reason: "Wrong part", RefundAmount: 125.5, RefundMethod: "transfer", RequestedAt: now,
		ApprovedAt: &now, RefundedAt: &now, Note: "Checked", CreatedBy: 5, CreatedByUser: creator,
		ApprovedBy: &approverID, RefundedBy: &refunderID, ApprovedByUser: approver,
		SalesReturnItems: []entity.SalesReturnItem{{
			Model: gorm.Model{ID: 21, CreatedAt: now, UpdatedAt: now}, SalesReturnID: 11,
			ProductID: 31, Product: &entity.Product{Product_Name: "Brake pad", Part_Number: "PART-31"},
			Quantity: 2, UnitPrice: 62.75,
		}},
	}
	repo := newMockReturnRepo(t)
	repo.getReturnFn = func(id uint) (*entity.SalesReturn, error) {
		if id != 11 {
			t.Fatalf("return ID = %d, want 11", id)
		}
		return row, nil
	}
	got, err := returnService.NewReturnService(repo).GetReturnByID(11)
	if err != nil {
		t.Fatal(err)
	}
	want := &returnDTO.ReturnDetailResponseDTO{
		ID: 11, ReturnNumber: "RET-011", OriginalOrderID: 41, OriginalOrder: order,
		ReturnDate: now, Status: enum.ReturnRefunded, Reason: "Wrong part", RefundAmount: 125.5,
		RefundMethod: "transfer", RequestedAt: now, ApprovedAt: &now, RefundedAt: &now,
		Note: "Checked", CreatedBy: 5, CreatedByUser: creator, ApprovedBy: &approverID,
		RefundedBy: &refunderID, ApprovedByUser: approver, CreatedAt: now, UpdatedAt: now,
		SalesReturnItems: []returnDTO.ReturnItemDetailDTO{{
			ID: 21, SalesReturnID: 11, ProductID: 31, ProductName: "Brake pad", ProductCode: "PART-31",
			Quantity: 2, UnitPrice: 62.75, Subtotal: 125.5, CreatedAt: now, UpdatedAt: now,
		}},
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("return detail = %+v, want %+v", got, want)
	}
	if repo.called["GetReturnByID"] != 1 {
		t.Fatalf("repository calls = %v, want one lookup", repo.called)
	}
}

func TestReturnService_GetReturnByID_RepositoryError(t *testing.T) {
	for _, wantErr := range []error{gorm.ErrRecordNotFound, errors.New("database unavailable")} {
		t.Run(wantErr.Error(), func(t *testing.T) {
			repo := newMockReturnRepo(t)
			repo.getReturnFn = func(id uint) (*entity.SalesReturn, error) {
				if id != 99 {
					t.Fatalf("return ID = %d, want 99", id)
				}
				return nil, wantErr
			}
			got, err := returnService.NewReturnService(repo).GetReturnByID(99)
			if !errors.Is(err, wantErr) || got != nil {
				t.Fatalf("GetReturnByID() = (%+v, %v), want (nil, %v)", got, err, wantErr)
			}
		})
	}
}
