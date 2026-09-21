//go:build integration

package importbill

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"backend/internal/app/entity"
	"backend/internal/app/enum"
	billRoute "backend/internal/app/route/import_bill"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

type importHTTPTransport func(*http.Request) (*http.Response, error)

func (f importHTTPTransport) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

// Run explicitly: go test -tags=integration ./internal/test/import_bill -run TestImportBillHTTP -count=1 -v
// Uses actual TCP HTTP, auth, routes, controller, service and repository with an
// isolated SQLite database. No production DB, OCR, storage or notification calls.
// Invalid-input cases assert rejection, so uncovered validation bugs fail visibly.
func TestImportBillHTTP(t *testing.T) {
	const secret = "isolated-import-http-test-secret"
	t.Setenv("JWT_SECRET", secret)
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	// Confirm starts asynchronous barcode generation against port 8000. Intercept
	// it BEFORE starting any requests; never forward calls to the running service.
	generated := make(chan struct{}, 64)
	oldTransport := http.DefaultTransport
	http.DefaultTransport = importHTTPTransport(func(r *http.Request) (*http.Response, error) {
		if r.Body != nil {
			defer r.Body.Close()
		}
		if r.Method != http.MethodPost || r.URL.String() != "http://127.0.0.1:8000/api/products/generate-codes" {
			return nil, fmt.Errorf("external request blocked by import HTTP test: %s", r.URL.Path)
		}
		generated <- struct{}{}
		return &http.Response{StatusCode: http.StatusOK, Header: make(http.Header),
			Body: io.NopCloser(strings.NewReader(`{"message":"test stub"}`)), Request: r}, nil
	})
	t.Cleanup(func() { http.DefaultTransport = oldTransport })

	token := func(role string) string {
		value, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": 1, "role": role, "exp": time.Now().Add(time.Hour).Unix(),
		}).SignedString([]byte(secret))
		require.NoError(t, err)
		return value
	}
	owner, employee, customer := token(string(enum.RoleOwner)), token(string(enum.RoleEmployee)), token("Customer")

	newFixture := func(t *testing.T) (*gorm.DB, *entity.Product, map[string]any, func(string, string, string, any) (int, []byte)) {
		db := setupImportBillTestDB(t)
		sqlDB, err := db.DB()
		require.NoError(t, err)
		sqlDB.SetMaxOpenConns(1) // :memory: must use the same connection on the HTTP goroutine.
		t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
		product, supplier := seedProductForImport(t, db, 100)
		require.NoError(t, db.Model(product).Update("quantity", 10).Error)
		require.NoError(t, db.Create(&entity.Inventory{
			ProductID: product.ID, SupplierID: supplier.ID, Inventory_Quantity: 10,
		}).Error)
		router := gin.New()
		router.Use(gin.Recovery())
		billRoute.SetupBillRoutes(router, db, nil)
		server := httptest.NewServer(router)
		t.Cleanup(server.Close)
		// Explicit transport: only the test client can reach our isolated server.
		transport := &http.Transport{Proxy: nil}
		t.Cleanup(transport.CloseIdleConnections)
		client := &http.Client{Transport: transport, Timeout: 5 * time.Second}
		payload := map[string]any{
			"bill": map[string]any{
				"bill_no": "HTTP-IMPORT-TEST", "supplier_id": supplier.ID,
				"due_date": "2026-10-09", "receive_date": "2026-09-09",
				"total_amount": 300, "subtotal": 300, "grand_total": 300,
				"payment_status": "pending", "verified_by": 1,
			},
			"items": []map[string]any{{
				"item_sequence": 1, "company_product_code": "TEST-001",
				"company_product_name": product.Product_Name, "product_id": product.ID,
				"order_quantity": 2, "unit": "ชิ้น", "conversion_factor": 1,
				"price_per_unit": 150, "net_amount": 300,
			}},
		}
		send := func(method, path, auth string, body any) (int, []byte) {
			var raw []byte
			if s, ok := body.(string); ok {
				raw = []byte(s)
			} else if body != nil {
				raw, err = json.Marshal(body)
				require.NoError(t, err)
			}
			req, err := http.NewRequest(method, server.URL+path, bytes.NewReader(raw))
			require.NoError(t, err)
			req.Header.Set("Content-Type", "application/json")
			if auth != "" {
				req.Header.Set("Authorization", "Bearer "+auth)
			}
			resp, err := client.Do(req)
			require.NoError(t, err)
			defer resp.Body.Close()
			data, err := io.ReadAll(resp.Body)
			require.NoError(t, err)
			// Await the asynchronous transport lookup before restoring the global
			// transport at cleanup, including when a validation assertion fails.
			if resp.StatusCode == http.StatusCreated && strings.HasSuffix(path, "/confirm") {
				var result struct {
					Data struct {
						Items []struct {
							ProductID uint `json:"product_id"`
						} `json:"items"`
					} `json:"data"`
				}
				require.NoError(t, json.Unmarshal(data, &result))
				for _, item := range result.Data.Items {
					if item.ProductID > 0 {
						select {
						case <-generated:
						case <-time.After(5 * time.Second):
							t.Fatal("barcode stub was not called")
						}
						break
					}
				}
			}
			t.Logf("%s %s -> HTTP %d", method, path, resp.StatusCode)
			return resp.StatusCode, data
		}
		return db, product, payload, send
	}
	const confirm = "/api/import-data/bill-import-jobs/0/confirm"

	t.Run("owner_confirm_list_and_duplicate_does_not_double_stock", func(t *testing.T) {
		db, product, payload, send := newFixture(t)
		for i := 0; i < 2; i++ {
			status, body := send(http.MethodPost, confirm, owner, payload)
			require.Equal(t, http.StatusCreated, status, string(body))
			var bill entity.Bill
			require.NoError(t, db.First(&bill).Error)
			assert.True(t, bill.IsVerified)
			require.NoError(t, db.First(product, product.ID).Error)
			assert.Equal(t, 12, product.Quantity)
			assert.Equal(t, float64(150), product.Cost_price)
			var inventory entity.Inventory
			require.NoError(t, db.First(&inventory).Error)
			assert.Equal(t, 12, inventory.Inventory_Quantity)
			var count int64
			require.NoError(t, db.Model(&entity.Bill{}).Count(&count).Error)
			assert.EqualValues(t, 1, count)
			require.NoError(t, db.Model(&entity.BillItem{}).Count(&count).Error)
			assert.EqualValues(t, 1, count)
		}
		status, body := send(http.MethodGet, "/api/import-data/bills", owner, nil)
		require.Equal(t, http.StatusOK, status, string(body))
		assert.Contains(t, string(body), "HTTP-IMPORT-TEST")
	})

	t.Run("employee_price_change_needs_owner_approval", func(t *testing.T) {
		db, product, payload, send := newFixture(t)
		status, body := send(http.MethodPost, confirm, employee, payload)
		require.Equal(t, http.StatusCreated, status, string(body))
		var bill entity.Bill
		require.NoError(t, db.First(&bill).Error)
		assert.False(t, bill.IsVerified)
		require.NoError(t, db.First(product, product.ID).Error)
		assert.Equal(t, float64(100), product.Cost_price)
		payload["bill"].(map[string]any)["is_verified"] = true
		path := fmt.Sprintf("/api/import-data/bills/%d", bill.ID)
		status, body = send(http.MethodPut, path, employee, payload)
		require.Equal(t, http.StatusForbidden, status, string(body))
		require.NoError(t, db.First(&bill, bill.ID).Error)
		assert.False(t, bill.IsVerified)
		status, body = send(http.MethodPut, path, owner, payload)
		require.Equal(t, http.StatusOK, status, string(body))
		require.NoError(t, db.First(&bill, bill.ID).Error)
		assert.True(t, bill.IsVerified)
		require.NoError(t, db.First(product, product.ID).Error)
		assert.Equal(t, float64(150), product.Cost_price)
		assert.Equal(t, 12, product.Quantity, "approval must not add stock again")
	})

	for _, tc := range []struct {
		name   string
		auth   string
		status int
		mutate func(map[string]any)
	}{
		{"no_token", "", 401, nil},
		{"wrong_role", customer, 403, nil},
		{"missing_bill_number", owner, 400, func(p map[string]any) { delete(p["bill"].(map[string]any), "bill_no") }},
		{"negative_total", owner, 400, func(p map[string]any) { p["bill"].(map[string]any)["total_amount"] = -1 }},
		{"missing_items", owner, 400, func(p map[string]any) { delete(p, "items") }},
		{"empty_items", owner, 400, func(p map[string]any) { p["items"] = []map[string]any{} }},
		{"missing_item_name", owner, 400, func(p map[string]any) { delete(p["items"].([]map[string]any)[0], "company_product_name") }},
		{"zero_quantity", owner, 400, func(p map[string]any) { p["items"].([]map[string]any)[0]["order_quantity"] = 0 }},
		{"negative_quantity", owner, 400, func(p map[string]any) { p["items"].([]map[string]any)[0]["order_quantity"] = -2 }},
		{"negative_unit_price", owner, 400, func(p map[string]any) { p["items"].([]map[string]any)[0]["price_per_unit"] = -150 }},
		{"zero_conversion_factor", owner, 400, func(p map[string]any) { p["items"].([]map[string]any)[0]["conversion_factor"] = 0 }},
		{"negative_conversion_factor", owner, 400, func(p map[string]any) { p["items"].([]map[string]any)[0]["conversion_factor"] = -1 }},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, product, payload, send := newFixture(t)
			if tc.mutate != nil {
				tc.mutate(payload)
			}
			status, body := send(http.MethodPost, confirm, tc.auth, payload)
			assert.Equal(t, tc.status, status, string(body))
			var count int64
			require.NoError(t, db.Model(&entity.Bill{}).Count(&count).Error)
			assert.Zero(t, count, "rejected input must not save a bill")
			require.NoError(t, db.First(product, product.ID).Error)
			assert.Equal(t, 10, product.Quantity, "rejected input must not change stock")
			t.Logf("persisted bills=%d, product quantity=%d, cost=%.2f", count, product.Quantity, product.Cost_price)
		})
	}
	t.Run("malformed_json", func(t *testing.T) {
		_, _, _, send := newFixture(t)
		status, _ := send(http.MethodPost, confirm, owner, `{"bill":`)
		assert.Equal(t, http.StatusBadRequest, status)
	})

	// mobile_upload_session_is_issued_and_enforced: regression test for the mobile QR
	// upload flow — the session used to be accepted just for "looking" well-formed
	// (matching a regex), so anyone could guess a valid-looking string and read/clear
	// another session's images without ever logging in or scanning a real QR code.
	// Now a session must have actually been issued by the authenticated endpoint below.
	t.Run("mobile_upload_session_is_issued_and_enforced", func(t *testing.T) {
		_, _, _, send := newFixture(t)

		status, body := send(http.MethodPost, "/api/import-data/mobile-sessions", owner, nil)
		require.Equal(t, http.StatusOK, status, string(body))
		var created struct {
			Session   string `json:"session"`
			ExpiresAt string `json:"expires_at"`
		}
		require.NoError(t, json.Unmarshal(body, &created))
		require.NotEmpty(t, created.Session)
		require.NotEmpty(t, created.ExpiresAt)

		// A well-formed but never-issued session must be rejected — this is the gap that was fixed.
		status, _ = send(http.MethodGet, "/api/mobile/images?session=guessed-session-1234", "", nil)
		assert.Equal(t, http.StatusUnauthorized, status)

		// A genuinely issued session is accepted, with no staff login required (the phone has none).
		status, body = send(http.MethodGet, "/api/mobile/images?session="+created.Session, "", nil)
		require.Equal(t, http.StatusOK, status, string(body))

		// Clearing the session (desktop is done) must invalidate it for further use.
		status, _ = send(http.MethodDelete, "/api/mobile/images?session="+created.Session, "", nil)
		require.Equal(t, http.StatusOK, status)

		status, _ = send(http.MethodGet, "/api/mobile/images?session="+created.Session, "", nil)
		assert.Equal(t, http.StatusUnauthorized, status, "a cleared session must not be reusable")
	})
}
