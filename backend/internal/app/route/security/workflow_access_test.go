package security_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"backend/internal/app/route/catalog"
	"backend/internal/app/route/claim"
	"backend/internal/app/route/import_bill"
	"backend/internal/app/route/pre_order"
	returns "backend/internal/app/route/return"

	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

const testSecret = "workflow-security-tests-only-not-a-production-secret"

func tokenFor(t *testing.T, role, secret string, expiry time.Time) string {
	t.Helper()
	claims := jwt.MapClaims{"user_id": 42, "exp": expiry.Unix()}
	if role != "" {
		claims["role"] = role
	}
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return token
}

func router(t *testing.T) *gin.Engine {
	t.Helper()
	t.Setenv("JWT_SECRET", testSecret)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	// Nil DB deliberately ensures denied requests cannot query or mutate real data.
	import_bill.SetupBillRoutes(r, nil, nil)
	pre_order.SetupPreOrderRoutes(r, nil, nil)
	claim.SetupClaimRoutes(r, nil, nil)
	// Catalog construction checks for demo data. Satisfy only that startup check
	// in a disposable database; request handlers still receive malformed JSON.
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	if err := db.Exec("CREATE TABLE catalogs (id INTEGER PRIMARY KEY)").Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Exec("INSERT INTO catalogs (id) VALUES (1)").Error; err != nil {
		t.Fatal(err)
	}
	catalog.SetupCatalogRoutes(r, db)
	returns.SetupReturnRoutes(r, nil)
	return r
}

func request(r *gin.Engine, method, path, token, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)
	return rec
}

func TestOCRAliasesRequireAuthorizationBeforeForwarding(t *testing.T) {
	var calls atomic.Int32
	upstream := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		if (r.URL.Path != "/api/extract-invoice/upload" && r.URL.Path != "/api/extract-catalog") || r.Method != http.MethodPost {
			t.Errorf("unexpected upstream request: %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"items":[]}`)
	}))
	t.Cleanup(upstream.Close)
	t.Setenv("OCR_SERVICE_URL", upstream.URL)
	r := router(t)
	now := time.Now()
	cases := []struct {
		name, token string
		status      int
	}{
		{"anonymous", "", http.StatusUnauthorized},
		{"malformed", "not-a-jwt", http.StatusUnauthorized},
		{"expired", tokenFor(t, "Owner", testSecret, now.Add(-time.Hour)), http.StatusUnauthorized},
		{"wrong-signature", tokenFor(t, "Owner", "wrong-secret", now.Add(time.Hour)), http.StatusUnauthorized},
		{"missing-role", tokenFor(t, "", testSecret, now.Add(time.Hour)), http.StatusUnauthorized},
		{"unknown-role", tokenFor(t, "Customer", testSecret, now.Add(time.Hour)), http.StatusForbidden},
	}
	for _, path := range []string{"/api/ocr/extract-invoice/upload", "/api/ocr/api/extract-invoice/upload", "/ocr/api/extract-invoice/upload", "/api/catalogs/extract-image"} {
		for _, tc := range cases {
			t.Run(path+"/"+tc.name, func(t *testing.T) {
				before := calls.Load()
				got := request(r, http.MethodPost, path, tc.token, `{}`)
				if got.Code != tc.status {
					t.Errorf("status = %d, want %d", got.Code, tc.status)
				}
				if calls.Load() != before {
					t.Error("unauthorized request reached OCR upstream")
				}
			})
		}
		for _, role := range []string{"Owner", "Employee", "Manager", "Admin"} {
			t.Run(path+"/"+role, func(t *testing.T) {
				before := calls.Load()
				got := request(r, http.MethodPost, path, tokenFor(t, role, testSecret, now.Add(time.Hour)), `{}`)
				if got.Code != http.StatusOK || calls.Load() != before+1 {
					t.Fatalf("authorized OCR failed: %d %s", got.Code, got.Body.String())
				}
			})
		}
	}
}

func TestWorkflowRoutesRejectAnonymousRequests(t *testing.T) {
	r := router(t)
	for _, route := range r.Routes() {
		// Mobile QR transfer uses a separate capability token, not staff JWT auth.
		if strings.HasPrefix(route.Path, "/api/mobile/") {
			continue
		}
		path := strings.ReplaceAll(strings.ReplaceAll(route.Path, ":id", "1"), ":itemId", "1")
		path = strings.ReplaceAll(path, ":number", "TEST")
		t.Run(route.Method+" "+path, func(t *testing.T) {
			got := request(r, route.Method, path, "", `{`)
			if got.Code != http.StatusUnauthorized {
				t.Fatalf("status = %d, want 401", got.Code)
			}
		})
	}
}

func TestWorkflowRolesReachValidationWithoutDatabaseWrites(t *testing.T) {
	r := router(t)
	for _, path := range []string{"/api/import-data/bills", "/api/wms/pre-orders", "/api/claims/customer-claims", "/api/claims/supplier-claims", "/api/claims/sales-returns", "/api/returns", "/api/catalogs"} {
		for _, role := range []string{"Owner", "Employee", "Manager", "Admin", "Customer", ""} {
			t.Run(path+"/"+role, func(t *testing.T) {
				want := http.StatusBadRequest // malformed JSON reaches the real controller
				if role == "Customer" {
					want = http.StatusForbidden
				}
				if role == "" {
					want = http.StatusUnauthorized
				}
				got := request(r, http.MethodPost, path, tokenFor(t, role, testSecret, time.Now().Add(time.Hour)), `{`)
				if got.Code != want {
					t.Fatalf("status = %d, want %d", got.Code, want)
				}
			})
		}
	}

}

func TestEmployeeCannotChangeProtectedPricesOrApproveReturns(t *testing.T) {
	r := router(t)
	token := tokenFor(t, "Employee", testSecret, time.Now().Add(time.Hour))
	for _, path := range []string{"/api/import-data/products/1", "/api/import-data/products/1/cost-price", "/api/returns/1"} {
		t.Run(path, func(t *testing.T) {
			got := request(r, http.MethodPut, path, token, `{}`)
			if got.Code != http.StatusForbidden {
				t.Fatalf("status = %d, want 403", got.Code)
			}
		})
	}
}
