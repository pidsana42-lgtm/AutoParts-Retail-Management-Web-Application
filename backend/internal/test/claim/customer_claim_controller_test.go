package claim

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	claimController "backend/internal/app/controller/claim"
	claimDTO "backend/internal/app/dto/claim"
	claimSvc "backend/internal/app/service/claim"

	"github.com/gin-gonic/gin"
)

// The controller tests supply authenticated context directly, mirroring the
// return controller test suite. Authentication middleware and database
// transactions are outside this suite's scope.
type customerClaimServiceStub struct {
	err            error
	calls          []string
	itemID         uint
	statusReceived string
}

var _ claimSvc.CustomerClaimService = (*customerClaimServiceStub)(nil)

func (s *customerClaimServiceStub) CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO, createdBy uint) (claimDTO.CustomerClaimResponseDTO, error) {
	s.calls = append(s.calls, "CreateCustomerClaim")
	return claimDTO.CustomerClaimResponseDTO{}, s.err
}
func (s *customerClaimServiceStub) CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error) {
	s.calls = append(s.calls, "CreateCustomerClaimItem")
	return claimDTO.CustomerClaimItemResponseDTO{}, s.err
}
func (s *customerClaimServiceStub) GetCustomerClaimByID(id uint) (claimDTO.CustomerClaimResponseDTO, error) {
	s.calls = append(s.calls, "GetCustomerClaimByID")
	return claimDTO.CustomerClaimResponseDTO{ID: id}, s.err
}
func (s *customerClaimServiceStub) ListCustomerClaims() ([]claimDTO.CustomerClaimResponseDTO, error) {
	s.calls = append(s.calls, "ListCustomerClaims")
	return nil, s.err
}
func (s *customerClaimServiceStub) UpdateCustomerClaim(id uint, input claimDTO.UpdateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error) {
	s.calls = append(s.calls, "UpdateCustomerClaim")
	return claimDTO.CustomerClaimResponseDTO{ID: id}, s.err
}
func (s *customerClaimServiceStub) UpdateCustomerClaimItem(id uint, input claimDTO.UpdateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error) {
	s.calls = append(s.calls, "UpdateCustomerClaimItem")
	return claimDTO.CustomerClaimItemResponseDTO{ID: id}, s.err
}
func (s *customerClaimServiceStub) UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error) {
	s.calls = append(s.calls, "UpdateCustomerClaimItemStatus")
	s.itemID = id
	s.statusReceived = status
	return claimDTO.CustomerClaimItemResponseDTO{ID: id, Status: status}, s.err
}
func (s *customerClaimServiceStub) DeleteCustomerClaim(id uint) error {
	s.calls = append(s.calls, "DeleteCustomerClaim")
	return s.err
}
func (s *customerClaimServiceStub) GenerateCustomerClaimPDF(ctx context.Context, claimID uint) ([]byte, error) {
	s.calls = append(s.calls, "GenerateCustomerClaimPDF")
	return nil, s.err
}
func (s *customerClaimServiceStub) GenerateCustomerClaimChecklistPDF(ctx context.Context, status string, search string) ([]byte, error) {
	s.calls = append(s.calls, "GenerateCustomerClaimChecklistPDF")
	return nil, s.err
}

func requestCustomerClaimController(service *customerClaimServiceStub, method, path, body string, role any) *httptest.ResponseRecorder {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		if role != nil {
			c.Set("role", role)
		}
		c.Next()
	})
	controller := claimController.NewCustomerClaimController(service)
	router.PUT("/api/claims/customer-claims/items/:itemId/status", controller.UpdateCustomerClaimItemStatus)
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	return response
}

// Regression test for the customer-claim approve/reject endpoint that used to
// accept a status change from ANY authenticated role (even "Customer"),
// because the route group only ran AuthMiddleware with no role check at all.
// The frontend already hid the approve/reject controls for non-owner roles
// (claim_detail.tsx's isManager check), but nothing stopped a non-owner
// caller from hitting the API directly. UpdateCustomerClaimItemStatus now
// enforces the same OWNER/ADMIN boundary the return controller uses.
func TestUpdateCustomerClaimItemStatusRoleBoundaries(t *testing.T) {
	roles := []struct {
		name    string
		role    any
		allowed bool
	}{
		{"owner", "OWNER", true},
		{"normalized_admin", " admin ", true},
		{"employee", "EMPLOYEE", false},
		{"customer", "CUSTOMER", false},
		{"missing", nil, false},
		{"wrong_type", 1, false},
	}
	for _, tt := range roles {
		t.Run(tt.name, func(t *testing.T) {
			service := &customerClaimServiceStub{}
			body := `{"status":"APPROVED"}`
			response := requestCustomerClaimController(service, http.MethodPut, "/api/claims/customer-claims/items/7/status", body, tt.role)

			if !tt.allowed {
				if response.Code != http.StatusForbidden {
					t.Fatalf("status = %d, want %d (body = %s)", response.Code, http.StatusForbidden, response.Body.String())
				}
				if len(service.calls) != 0 {
					t.Fatalf("forbidden request reached service: %v", service.calls)
				}
				return
			}

			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want %d (body = %s)", response.Code, http.StatusOK, response.Body.String())
			}
			if len(service.calls) != 1 || service.calls[0] != "UpdateCustomerClaimItemStatus" {
				t.Fatalf("service calls = %v, want exactly one UpdateCustomerClaimItemStatus", service.calls)
			}
			if service.itemID != 7 || service.statusReceived != "APPROVED" {
				t.Fatalf("service received itemID=%d status=%q, want itemID=7 status=APPROVED", service.itemID, service.statusReceived)
			}
			var payload struct {
				Data claimDTO.CustomerClaimItemResponseDTO `json:"data"`
			}
			if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
				t.Fatal(err)
			}
			if payload.Data.ID != 7 || payload.Data.Status != "APPROVED" {
				t.Fatalf("response data = %+v", payload.Data)
			}
		})
	}
}
