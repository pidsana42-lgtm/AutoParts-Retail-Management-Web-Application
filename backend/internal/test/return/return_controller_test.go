package returns_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	returnController "backend/internal/app/controller/return"
	returnDTO "backend/internal/app/dto/return"
	returnRepo "backend/internal/app/repository/return"
	returnService "backend/internal/app/service/return"

	"github.com/gin-gonic/gin"
)

// The controller tests supply authenticated context directly. Authentication
// middleware and database transactions are outside this suite's scope.
type returnHTTPServiceStub struct {
	err           error
	calls         []string
	id            uint
	actorID       uint
	role          string
	createInput   returnDTO.CreateReturnDTO
	updateInput   returnDTO.UpdateReturnDTO
	listInput     returnDTO.GetReturnsRequest
	searchKeyword string
}

var _ returnService.ReturnService = (*returnHTTPServiceStub)(nil)

func (s *returnHTTPServiceStub) record(method string, id, actorID uint) (*returnDTO.ReturnDetailResponseDTO, error) {
	s.calls = append(s.calls, method)
	s.id, s.actorID = id, actorID
	if s.err != nil {
		return nil, s.err
	}
	return &returnDTO.ReturnDetailResponseDTO{ID: 42, ReturnNumber: "RTN-TEST-0042"}, nil
}

func (s *returnHTTPServiceStub) GetReturns(input returnDTO.GetReturnsRequest) (*returnDTO.GetReturnsResponse, error) {
	s.calls = append(s.calls, "GetReturns")
	s.listInput = input
	return &returnDTO.GetReturnsResponse{Page: input.Page, PageSize: input.PageSize, TotalCount: 3}, s.err
}

func (s *returnHTTPServiceStub) SearchReturnableSaleOrders(keyword string) ([]returnDTO.ReturnableSaleOrderDTO, error) {
	s.calls = append(s.calls, "SearchReturnableSaleOrders")
	s.searchKeyword = keyword
	return []returnDTO.ReturnableSaleOrderDTO{{ID: 9, OrderNumber: "SO-0009"}}, s.err
}

func (s *returnHTTPServiceStub) GetReturnByID(id uint) (*returnDTO.ReturnDetailResponseDTO, error) {
	return s.record("GetReturnByID", id, 0)
}

func (s *returnHTTPServiceStub) CreateReturn(input returnDTO.CreateReturnDTO, actorID uint, role string) (*returnDTO.ReturnDetailResponseDTO, error) {
	s.createInput, s.role = input, role
	return s.record("CreateReturn", 0, actorID)
}

func (s *returnHTTPServiceStub) UpdateReturn(id uint, input returnDTO.UpdateReturnDTO, actorID uint) (*returnDTO.ReturnDetailResponseDTO, error) {
	s.updateInput = input
	return s.record("UpdateReturn", id, actorID)
}

func (s *returnHTTPServiceStub) ProcessRefund(id, actorID uint) (*returnDTO.ReturnDetailResponseDTO, error) {
	return s.record("ProcessRefund", id, actorID)
}

func (s *returnHTTPServiceStub) DeleteReturn(id uint) error {
	_, err := s.record("DeleteReturn", id, 0)
	return err
}

func requestReturnController(service returnService.ReturnService, method, path, body string, userID, role any) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if userID != nil {
			c.Set("user_id", userID)
		}
		if role != nil {
			c.Set("role", role)
		}
		c.Next()
	})
	controller := returnController.NewReturnController(service)
	router.GET("/api/returns", controller.GetReturns)
	router.GET("/api/returns/sale-orders/search", controller.SearchReturnableSaleOrders)
	router.GET("/api/returns/:id", controller.GetReturnByID)
	router.POST("/api/returns", controller.CreateSalesReturn)
	router.PUT("/api/returns/:id", controller.UpdateSalesReturn)
	router.POST("/api/returns/:id/refund", controller.ProcessRefund)
	router.DELETE("/api/returns/:id", controller.DeleteSalesReturn)
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

func assertReturnHTTPStatus(t *testing.T, response *httptest.ResponseRecorder, want int) {
	t.Helper()
	if response.Code != want {
		t.Fatalf("HTTP status = %d, want %d; body = %s", response.Code, want, response.Body.String())
	}
	if contentType := response.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "application/json") {
		t.Fatalf("Content-Type = %q, want JSON", contentType)
	}
}

const validReturnCreateJSON = `{"original_order_id":9,"reason":"Wrong part","refund_method":"CASH","items":[{"product_id":5,"quantity":1,"unit_price":250}]}`

func TestReturnControllerCreateUsesAuthenticatedActorAndRole(t *testing.T) {
	// JSON-decoded JWT claims use float64; internal callers also use integer IDs.
	for _, actor := range []any{float64(23), uint(23), int(23), int64(23)} {
		t.Run(fmt.Sprintf("actor_%T", actor), func(t *testing.T) {
			service := &returnHTTPServiceStub{}
			body := `{"original_order_id":9,"reason":"Wrong part","refund_method":"CASH","created_by":999,"approved_by":998,"role":"OWNER","status":"APPROVED","items":[{"product_id":1,"quantity":1,"unit_price":100}]}`
			response := requestReturnController(service, http.MethodPost, "/api/returns", body, actor, " employee ")
			assertReturnHTTPStatus(t, response, http.StatusCreated)
			if len(service.calls) != 1 || service.calls[0] != "CreateReturn" || service.actorID != 23 || service.role != "EMPLOYEE" {
				t.Fatalf("service call = %+v; want one CreateReturn with actor 23 and EMPLOYEE role", service)
			}
			if service.createInput.OriginalOrderID != 9 || service.createInput.Reason != "Wrong part" || service.createInput.RefundMethod != "CASH" {
				t.Fatalf("bound create input = %+v", service.createInput)
			}
			var payload struct {
				Message string                            `json:"message"`
				Data    returnDTO.ReturnDetailResponseDTO `json:"data"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			if payload.Message != "Created successfully" || payload.Data.ID != 42 || payload.Data.ReturnNumber != "RTN-TEST-0042" {
				t.Fatalf("create response = %+v", payload)
			}
		})
	}
}

func TestReturnControllerRoleBoundariesAndTrustedActors(t *testing.T) {
	operations := []struct {
		name, method, path, body, serviceMethod string
		employeeAllowed                         bool
	}{
		{"approve", http.MethodPut, "/api/returns/42", `{"status":"APPROVED","approved_by":999,"role":"OWNER"}`, "UpdateReturn", false},
		{"reject", http.MethodPut, "/api/returns/42", `{"status":"REJECTED","approved_by":999,"role":"OWNER"}`, "UpdateReturn", false},
		{"refund", http.MethodPost, "/api/returns/42/refund", `{"refunded_by":999,"role":"OWNER"}`, "ProcessRefund", true},
	}
	roles := []struct {
		name string
		role any
	}{
		{"owner", "OWNER"}, {"normalized_admin", " admin "}, {"employee", " employee "},
		{"customer", "CUSTOMER"}, {"missing", nil}, {"wrong_type", 1},
	}
	for _, operation := range operations {
		for _, role := range roles {
			t.Run(operation.name+"/"+role.name, func(t *testing.T) {
				service := &returnHTTPServiceStub{}
				response := requestReturnController(service, operation.method, operation.path, operation.body, uint(23), role.role)
				allowed := role.name == "owner" || role.name == "normalized_admin" || (role.name == "employee" && operation.employeeAllowed)
				if !allowed {
					assertReturnHTTPStatus(t, response, http.StatusForbidden)
					if len(service.calls) != 0 {
						t.Fatalf("forbidden request reached service: %v", service.calls)
					}
					return
				}
				assertReturnHTTPStatus(t, response, http.StatusOK)
				if len(service.calls) != 1 || service.calls[0] != operation.serviceMethod || service.id != 42 || service.actorID != 23 {
					t.Fatalf("service call = %+v; want %s with ID 42 and authenticated actor 23", service, operation.serviceMethod)
				}
				if operation.name != "refund" {
					// APPROVED and REJECTED must reach the service unchanged.
					wantStatus := "APPROVED"
					if operation.name == "reject" {
						wantStatus = "REJECTED"
					}
					if service.updateInput.Status != wantStatus {
						t.Fatalf("status = %q, want %q", service.updateInput.Status, wantStatus)
					}
				}
				var payload struct {
					Data returnDTO.ReturnDetailResponseDTO `json:"data"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.Data.ID != 42 {
					t.Fatalf("response data = %+v, JSON error = %v", payload.Data, err)
				}
			})
		}
	}
}

func TestReturnControllerRejectsInvalidInputBeforeCallingService(t *testing.T) {
	tests := []struct {
		name, method, path, body string
	}{
		{"malformed_json", http.MethodPost, "/api/returns", `{"original_order_id":`},
		{"missing_order", http.MethodPost, "/api/returns", `{"reason":"Wrong part","refund_method":"CASH"}`},
		{"zero_order", http.MethodPost, "/api/returns", `{"original_order_id":0,"reason":"Wrong part","refund_method":"CASH"}`},
		{"missing_reason", http.MethodPost, "/api/returns", `{"original_order_id":9,"refund_method":"CASH"}`},
		{"missing_refund_method", http.MethodPost, "/api/returns", `{"original_order_id":9,"reason":"Wrong part"}`},
		{"wrong_order_type", http.MethodPost, "/api/returns", `{"original_order_id":"nine","reason":"Wrong part","refund_method":"CASH"}`},
		{"invalid_date", http.MethodPost, "/api/returns", `{"original_order_id":9,"reason":"Wrong part","refund_method":"CASH","return_date":"yesterday"}`},
		{"malformed_update", http.MethodPut, "/api/returns/42", `{"status":`},
		{"invalid_page", http.MethodGet, "/api/returns?page=abc", ""},
	}
	for _, id := range []string{"abc", "-1", "4294967296"} {
		for _, endpoint := range []struct{ name, method, suffix string }{
			{"get", http.MethodGet, ""}, {"update", http.MethodPut, ""},
			{"refund", http.MethodPost, "/refund"}, {"delete", http.MethodDelete, ""},
		} {
			tests = append(tests, struct{ name, method, path, body string }{
				endpoint.name + "_id_" + id, endpoint.method, "/api/returns/" + id + endpoint.suffix, `{"status":"APPROVED"}`,
			})
		}
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := &returnHTTPServiceStub{}
			response := requestReturnController(service, tt.method, tt.path, tt.body, uint(23), "OWNER")
			assertReturnHTTPStatus(t, response, http.StatusBadRequest)
			if len(service.calls) != 0 {
				t.Fatalf("invalid request reached service: %v", service.calls)
			}
			var payload struct {
				Error string `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.Error == "" {
				t.Fatalf("missing JSON error: %s (decode error %v)", response.Body.String(), err)
			}
		})
	}
}

func TestReturnControllerMapsWriteErrors(t *testing.T) {
	type errorCase struct {
		name       string
		err        error
		status     int
		fixedError string
	}
	operations := []struct {
		name, method, path, body, failurePrefix string
		cases                                   []errorCase
	}{
		{"create", http.MethodPost, "/api/returns", validReturnCreateJSON, "Failed to create return: ", []errorCase{
			{"order_in_progress", returnRepo.ErrOrderInProgress, http.StatusConflict, "sale order is already being claimed or returned"},
			{"order_not_completed", returnRepo.ErrOrderNotCompleted, http.StatusBadRequest, "only completed sale orders can be returned"},
			{"excess_quantity", returnRepo.ErrReturnQuantityExceedsOrder, http.StatusBadRequest, ""},
			{"excess_refund", returnRepo.ErrRefundAmountExceedsOrder, http.StatusBadRequest, ""},
			{"invalid_method", returnRepo.ErrInvalidRefundMethod, http.StatusBadRequest, ""},
			{"customer_required", returnRepo.ErrRefundRequiresCustomer, http.StatusBadRequest, ""},
			{"unexpected", errors.New("storage unavailable"), http.StatusInternalServerError, ""},
		}},
		{"update", http.MethodPut, "/api/returns/42", `{"status":"APPROVED"}`, "Failed to update return: ", []errorCase{
			{"invalid_status", returnService.ErrInvalidReturnStatus, http.StatusBadRequest, ""},
			{"already_processed", returnRepo.ErrReturnAlreadyProcessed, http.StatusConflict, ""},
			{"not_pending", returnRepo.ErrReturnNotPending, http.StatusConflict, ""},
			{"order_not_completed", returnRepo.ErrOrderNotCompleted, http.StatusBadRequest, ""},
			{"excess_quantity", returnRepo.ErrReturnQuantityExceedsOrder, http.StatusBadRequest, ""},
			{"excess_refund", returnRepo.ErrRefundAmountExceedsOrder, http.StatusBadRequest, ""},
			{"invalid_method", returnRepo.ErrInvalidRefundMethod, http.StatusBadRequest, ""},
			{"customer_required", returnRepo.ErrRefundRequiresCustomer, http.StatusBadRequest, ""},
			{"unexpected", errors.New("storage unavailable"), http.StatusInternalServerError, ""},
		}},
		{"refund", http.MethodPost, "/api/returns/42/refund", "", "Failed to process refund: ", []errorCase{
			{"not_approved", returnRepo.ErrReturnNotApproved, http.StatusConflict, ""},
			{"already_processed", returnRepo.ErrReturnAlreadyProcessed, http.StatusConflict, ""},
			{"invalid_method", returnRepo.ErrInvalidRefundMethod, http.StatusBadRequest, ""},
			{"customer_required", returnRepo.ErrRefundRequiresCustomer, http.StatusBadRequest, ""},
			{"excess_refund", returnRepo.ErrRefundAmountExceedsOrder, http.StatusBadRequest, ""},
			{"unexpected", errors.New("storage unavailable"), http.StatusInternalServerError, ""},
		}},
	}
	for _, operation := range operations {
		for _, tt := range operation.cases {
			t.Run(operation.name+"/"+tt.name, func(t *testing.T) {
				// Wrapped domain errors must retain their HTTP mapping via errors.Is.
				service := &returnHTTPServiceStub{err: fmt.Errorf("return operation: %w", tt.err)}
				response := requestReturnController(service, operation.method, operation.path, operation.body, uint(23), "OWNER")
				assertReturnHTTPStatus(t, response, tt.status)
				if len(service.calls) != 1 {
					t.Fatalf("service calls = %v, want exactly one", service.calls)
				}
				wantError := service.err.Error()
				if tt.fixedError != "" {
					wantError = tt.fixedError
				} else if tt.status == http.StatusInternalServerError {
					wantError = operation.failurePrefix + wantError
				}
				var payload struct {
					Error string `json:"error"`
				}
				if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
					t.Fatal(err)
				}
				if payload.Error != wantError {
					t.Fatalf("error = %q, want %q", payload.Error, wantError)
				}
			})
		}
	}
}

func TestReturnControllerBindsListAndSearchQueries(t *testing.T) {
	t.Run("list_filters_and_pagination", func(t *testing.T) {
		service := &returnHTTPServiceStub{}
		response := requestReturnController(service, http.MethodGet, "/api/returns?status=PENDING&search=wrong+part&page=2&page_size=5", "", uint(23), "EMPLOYEE")
		assertReturnHTTPStatus(t, response, http.StatusOK)
		want := returnDTO.GetReturnsRequest{Status: "PENDING", Search: "wrong part", Page: 2, PageSize: 5}
		if service.listInput != want || len(service.calls) != 1 {
			t.Fatalf("list input = %+v, calls = %v; want %+v", service.listInput, service.calls, want)
		}
		var payload returnDTO.GetReturnsResponse
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.TotalCount != 3 || payload.Page != 2 || payload.PageSize != 5 {
			t.Fatalf("list response = %+v, JSON error = %v", payload, err)
		}
	})
	for _, tt := range []struct{ name, query, keyword string }{
		{"search", "search=SO-0009", "SO-0009"},
		{"q_alias", "q=SO-0009", "SO-0009"},
		{"search_precedence", "search=SO-0009&q=ignored", "SO-0009"},
		{"empty_search_falls_back", "search=&q=SO-0009", "SO-0009"},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service := &returnHTTPServiceStub{}
			response := requestReturnController(service, http.MethodGet, "/api/returns/sale-orders/search?"+tt.query, "", uint(23), "EMPLOYEE")
			assertReturnHTTPStatus(t, response, http.StatusOK)
			if service.searchKeyword != tt.keyword || len(service.calls) != 1 {
				t.Fatalf("search keyword = %q, calls = %v; want %q", service.searchKeyword, service.calls, tt.keyword)
			}
			var payload struct {
				Data []returnDTO.ReturnableSaleOrderDTO `json:"data"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || len(payload.Data) != 1 || payload.Data[0].ID != 9 {
				t.Fatalf("search response = %+v, JSON error = %v", payload, err)
			}
		})
	}
}

func TestReturnControllerReadAndDeleteErrors(t *testing.T) {
	for _, tt := range []struct {
		name, method, path, prefix string
		status                     int
	}{
		{"list", http.MethodGet, "/api/returns", "", http.StatusBadRequest},
		{"search", http.MethodGet, "/api/returns/sale-orders/search", "Failed to search sale orders: ", http.StatusInternalServerError},
		{"detail", http.MethodGet, "/api/returns/42", "Return record not found: ", http.StatusNotFound},
		{"delete", http.MethodDelete, "/api/returns/42", "Failed to delete return: ", http.StatusInternalServerError},
	} {
		t.Run(tt.name, func(t *testing.T) {
			service := &returnHTTPServiceStub{err: errors.New("lookup failed")}
			response := requestReturnController(service, tt.method, tt.path, "", uint(23), "OWNER")
			assertReturnHTTPStatus(t, response, tt.status)
			var payload struct {
				Error string `json:"error"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil || payload.Error != tt.prefix+service.err.Error() || len(service.calls) != 1 {
				t.Fatalf("error response = %+v, calls = %v, JSON error = %v", payload, service.calls, err)
			}
		})
	}
}
