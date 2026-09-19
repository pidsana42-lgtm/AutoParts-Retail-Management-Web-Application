//go:build integration

package importbill

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"backend/internal/app/enum"
	billRoute "backend/internal/app/route/import_bill"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Run explicitly: go test -tags=integration ./internal/test/import_bill -run TestImportDataUpdateProductRoleBoundaries -count=1 -v
//
// Regression test for the "edit-stock-bill" page (frontend/src/app/owner/import-bills/edit-stock-bill):
// the route is gated on the frontend to owner/admin only (isAdminOrOwner in app_router.tsx), but it
// saves through PUT /api/import-data/products/:id, which used to sit in the Owner/Employee/Admin group —
// so an employee could call the endpoint directly and bypass the frontend restriction. It now lives in
// its own owner/admin-only route group.
func TestImportDataUpdateProductRoleBoundaries(t *testing.T) {
	const secret = "isolated-import-product-role-test-secret"
	t.Setenv("JWT_SECRET", secret)
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	token := func(role string) string {
		value, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
			"user_id": 1, "role": role, "exp": time.Now().Add(time.Hour).Unix(),
		}).SignedString([]byte(secret))
		require.NoError(t, err)
		return value
	}
	owner := token(string(enum.RoleOwner))
	admin := token(string(enum.RoleAdmin))
	employee := token(string(enum.RoleEmployee))
	customer := token("Customer")

	db := setupImportBillTestDB(t)
	product, _ := seedProductForImport(t, db, 100)

	router := gin.New()
	router.Use(gin.Recovery())
	billRoute.SetupBillRoutes(router, db, nil)
	server := httptest.NewServer(router)
	t.Cleanup(server.Close)
	client := &http.Client{Timeout: 5 * time.Second}

	send := func(auth string, costPrice float64) (int, []byte) {
		payload := map[string]any{
			"product_name":   product.Product_Name,
			"quantity":       product.Quantity,
			"limit_quantity": product.Limit_Quantity,
			"cost_price":     costPrice,
			"sale_price":     product.Sale_price,
			"category_id":    product.CategoryID,
			"grade_id":       product.GradeID,
			"unit_id":        product.UnitID,
			"shelf_id":       product.ShelfID,
		}
		raw, err := json.Marshal(payload)
		require.NoError(t, err)
		req, err := http.NewRequest(http.MethodPut, fmt.Sprintf("%s/api/import-data/products/%d", server.URL, product.ID), bytes.NewReader(raw))
		require.NoError(t, err)
		req.Header.Set("Content-Type", "application/json")
		if auth != "" {
			req.Header.Set("Authorization", "Bearer "+auth)
		}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()
		buf := new(bytes.Buffer)
		_, err = buf.ReadFrom(resp.Body)
		require.NoError(t, err)
		return resp.StatusCode, buf.Bytes()
	}

	for _, tc := range []struct {
		name   string
		auth   string
		status int
	}{
		{"owner_allowed", owner, http.StatusOK},
		{"admin_allowed", admin, http.StatusOK},
		{"employee_forbidden", employee, http.StatusForbidden},
		{"customer_forbidden", customer, http.StatusForbidden},
		{"no_token_unauthorized", "", http.StatusUnauthorized},
	} {
		t.Run(tc.name, func(t *testing.T) {
			status, body := send(tc.auth, 999)
			assert.Equal(t, tc.status, status, string(body))
		})
	}
}
