package returns_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	claimController "backend/internal/app/controller/claim"
	returnController "backend/internal/app/controller/return"
	"backend/internal/app/entity"
	claimRepo "backend/internal/app/repository/claim"
	returnRepo "backend/internal/app/repository/return"
	claimService "backend/internal/app/service/claim"
	returnService "backend/internal/app/service/return"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Regression tests of real handlers, services and repositories against isolated
// SQLite. Auth context is supplied directly; no live DB or notifications are used.
func TestClaimReturnValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	type auditCase struct {
		name   string
		mutate func(map[string]any, map[string]any)
		valid  bool
	}
	claimCases := []auditCase{
		{"valid", func(map[string]any, map[string]any) {}, true},
		{"missing_order", func(p, _ map[string]any) { delete(p, "original_order_id") }, false},
		{"missing_items", func(p, _ map[string]any) { delete(p, "items") }, false},
		{"empty_items", func(p, _ map[string]any) { p["items"] = []any{} }, false},
		{"zero_quantity", func(_, i map[string]any) { i["qty"] = 0 }, false},
		{"negative_quantity", func(_, i map[string]any) { i["qty"] = -1 }, false},
		{"fractional_quantity", func(_, i map[string]any) { i["qty"] = 0.5 }, false},
		{"negative_price", func(_, i map[string]any) { i["unit_price"] = -100 }, false},
		{"negative_claim_amount", func(p, _ map[string]any) { p["claim_amount"] = -100 }, false},
		{"negative_refund_amount", func(p, _ map[string]any) { p["refund_amount"] = -100 }, false},
		{"negative_replacement_cost", func(p, _ map[string]any) { p["replacement_cost"] = -100 }, false},
		{"missing_reason", func(_, i map[string]any) { delete(i, "reason") }, false},
		{"quantity_exceeds_sale", func(_, i map[string]any) { i["qty"] = 6 }, false},
		{"product_not_in_sale", func(_, i map[string]any) { i["product_id"] = 999999 }, false},
		{"duplicate_rows_exceed_sale", func(p, i map[string]any) { i["qty"] = 3; p["items"] = append(p["items"].([]any), i) }, false},
	}
	returnCases := []auditCase{
		{"valid", func(map[string]any, map[string]any) {}, true},
		{"missing_items", func(p, _ map[string]any) { delete(p, "sales_return_items") }, false},
		{"empty_items", func(p, _ map[string]any) { p["sales_return_items"] = []any{} }, false},
		{"zero_quantity", func(_, i map[string]any) { i["quantity"] = 0 }, false},
		{"negative_quantity", func(_, i map[string]any) { i["quantity"] = -1 }, false},
		{"negative_price", func(_, i map[string]any) { i["unit_price"] = -100 }, false},
		{"negative_refund_amount", func(p, _ map[string]any) { p["refund_amount"] = -100 }, false},
		{"invalid_refund_method", func(p, _ map[string]any) { p["refund_method"] = "INVALID" }, false},
		{"quantity_exceeds_sale", func(_, i map[string]any) { i["quantity"] = 6 }, false},
		{"product_not_in_sale", func(_, i map[string]any) { i["product_id"] = 999999 }, false},
		{"missing_reason", func(p, _ map[string]any) { delete(p, "reason") }, false},
		{"valid_legacy_items", func(p, _ map[string]any) { p["items"] = p["sales_return_items"]; delete(p, "sales_return_items") }, true},
		{"invalid_second_item", func(p, _ map[string]any) {
			p["sales_return_items"] = append(p["sales_return_items"].([]any), map[string]any{"product_id": 1, "quantity": -1, "unit_price": 100})
		}, false},
	}
	for _, group := range []struct {
		name  string
		cases []auditCase
	}{{"claim", claimCases}, {"return", returnCases}} {
		t.Run(group.name, func(t *testing.T) {
			for _, tc := range group.cases {
				t.Run(tc.name, func(t *testing.T) {
					db, order, product := newClaimReturnValidationDB(t)
					router := gin.New()
					router.Use(func(c *gin.Context) { c.Set("user_id", float64(1)); c.Set("role", "EMPLOYEE"); c.Next() })
					item := map[string]any{"product_id": product.ID, "unit_price": 100}
					payload := map[string]any{"original_order_id": order.ID}
					var headerModel, itemModel any
					if group.name == "claim" {
						item["qty"], item["reason"], item["claim_type"] = 1, "Defective part", "INSTANT"
						payload["items"] = []any{item}
						ctrl := claimController.NewCustomerClaimController(claimService.NewCustomerClaimService(claimRepo.NewCustomerClaimRepository(db), claimRepo.NewSaleOrderLookupRepository(db), nil))
						router.POST("/audit", ctrl.CreateCustomerClaim)
						headerModel, itemModel = &entity.CustomerClaim{}, &entity.CustomerClaimItem{}
					} else {
						item["quantity"] = 1
						payload["sales_return_items"] = []any{item}
						payload["return_number"], payload["reason"], payload["refund_method"] = "RTN-AUDIT", "Wrong part", "CASH"
						ctrl := returnController.NewReturnController(returnService.NewReturnService(returnRepo.NewReturnRepository(db)))
						router.POST("/audit", ctrl.CreateSalesReturn)
						headerModel, itemModel = &entity.SalesReturn{}, &entity.SalesReturnItem{}
					}
					tc.mutate(payload, item)
					body, err := json.Marshal(payload)
					require.NoError(t, err)
					req := httptest.NewRequest(http.MethodPost, "/audit", bytes.NewReader(body))
					req.Header.Set("Content-Type", "application/json")
					response := httptest.NewRecorder()
					router.ServeHTTP(response, req)
					var headers, items int64
					require.NoError(t, db.Model(headerModel).Count(&headers).Error)
					require.NoError(t, db.Model(itemModel).Count(&items).Error)
					want := http.StatusBadRequest
					if tc.valid {
						want = http.StatusCreated
					}
					if response.Code != want {
						t.Errorf("HTTP = %d, want %d; persisted headers = %d, items = %d; response = %s", response.Code, want, headers, items, response.Body.String())
					}
					if !tc.valid && (headers != 0 || items != 0) {
						t.Errorf("invalid input persisted: headers = %d, items = %d", headers, items)
					}
					if tc.valid {
						require.Equal(t, int64(1), headers)
						require.Equal(t, int64(1), items)
					}
					require.NoError(t, db.First(product, product.ID).Error)
					require.Equal(t, 5, product.Quantity, "pending requests must not change stock")
				})
			}
		})
	}
}

func newClaimReturnValidationDB(t *testing.T) (*gorm.DB, *entity.SaleOrder, *entity.Product) {
	db := setupReturnTestDB(t)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	require.NoError(t, db.AutoMigrate(&entity.CustomerClaim{}, &entity.CustomerClaimItem{}))
	// Claim associations migrate SaleOrder again; restore the SQLite-only
	// date-column adaptation before inserting fixtures (production uses timestamptz).
	require.NoError(t, db.Exec("DROP INDEX IF EXISTS idx_sale_orders_created_at_id").Error)
	require.NoError(t, db.Exec("ALTER TABLE sale_orders DROP COLUMN order_date").Error)
	require.NoError(t, db.Exec("ALTER TABLE sale_orders ADD COLUMN order_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP").Error)
	oldReturn, order, product := seedCompletedOrderWithReturn(t, db, 100, 1, 5)
	require.NoError(t, db.Where("sales_return_id = ?", oldReturn.ID).Delete(&entity.SalesReturnItem{}).Error)
	require.NoError(t, db.Delete(oldReturn).Error)
	return db, order, product
}

func TestClaimReturnUpdateValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	for _, tc := range []struct {
		name, target, body string
		want               int
	}{
		{"claim_negative_amount", "claim", `{"claim_amount":-1}`, 400},
		{"claim_negative_refund", "claim", `{"refund_amount":-1}`, 400},
		{"claim_negative_replacement", "claim", `{"replacement_cost":-1}`, 400},
		{"claim_note_only", "claim", `{"notes":"updated"}`, 200},
		{"item_negative_quantity", "item", `{"qty":-1}`, 400},
		{"item_fractional_quantity", "item", `{"qty":0.5}`, 400},
		{"item_negative_price", "item", `{"unit_price":-1}`, 400},
		{"item_excess_quantity", "item", `{"qty":6}`, 400},
		{"item_valid_quantity", "item", `{"qty":2}`, 200},
		{"standalone_excess_quantity", "append", `{"qty":5}`, 400},
		{"standalone_valid_quantity", "append", `{"qty":1}`, 201},
		{"return_negative_refund", "return", `{"refund_amount":-1}`, 400},
		{"return_invalid_method", "return", `{"refund_method":"INVALID"}`, 400},
		{"return_valid_method", "return", `{"refund_method":"TRANSFER"}`, 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, order, product := newClaimReturnValidationDB(t)
			router := gin.New()
			router.Use(func(c *gin.Context) { c.Set("user_id", float64(1)); c.Set("role", "OWNER"); c.Next() })
			method, path, body := http.MethodPut, "", []byte(tc.body)
			var claim entity.CustomerClaim
			var ret entity.SalesReturn
			if tc.target == "return" {
				ret = entity.SalesReturn{ReturnNumber: "RTN-UPDATE", OriginalOrderID: order.ID, Status: "PENDING", RefundAmount: 100, RefundMethod: "CASH"}
				require.NoError(t, db.Create(&ret).Error)
				ctrl := returnController.NewReturnController(returnService.NewReturnService(returnRepo.NewReturnRepository(db)))
				router.PUT("/returns/:id", ctrl.UpdateSalesReturn)
				path = fmt.Sprintf("/returns/%d", ret.ID)
			} else {
				claim = entity.CustomerClaim{OriginalOrderID: order.ID, Status: "PENDING", ClaimAmount: 100, RefundAmount: 100, ReplacementCost: 100, Items: []entity.CustomerClaimItem{{ProductID: product.ID, Qty: 1, Status: "PENDING", ClaimType: "INSTANT"}}}
				require.NoError(t, db.Create(&claim).Error)
				ctrl := claimController.NewCustomerClaimController(claimService.NewCustomerClaimService(claimRepo.NewCustomerClaimRepository(db), claimRepo.NewSaleOrderLookupRepository(db), nil))
				router.PUT("/claims/:id", ctrl.UpdateCustomerClaim)
				router.PUT("/items/:itemId", ctrl.UpdateCustomerClaimItem)
				router.POST("/items", ctrl.CreateCustomerClaimItem)
				path = fmt.Sprintf("/claims/%d", claim.ID)
				if tc.target == "item" {
					path = fmt.Sprintf("/items/%d", claim.Items[0].ID)
				}
				if tc.target == "append" {
					method, path = http.MethodPost, "/items"
					payload := map[string]any{}
					require.NoError(t, json.Unmarshal(body, &payload))
					payload["customer_claim_id"], payload["product_id"], payload["reason"] = claim.ID, product.ID, "Defect"
					var err error
					body, err = json.Marshal(payload)
					require.NoError(t, err)
				}
			}
			req := httptest.NewRequest(method, path, bytes.NewReader(body))
			req.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, req)
			require.Equal(t, tc.want, response.Code, response.Body.String())
			if tc.want == 400 {
				if tc.target == "return" {
					var saved entity.SalesReturn
					require.NoError(t, db.First(&saved, ret.ID).Error)
					require.Equal(t, float64(100), saved.RefundAmount)
					require.Equal(t, "CASH", saved.RefundMethod)
				} else {
					var saved entity.CustomerClaim
					require.NoError(t, db.Preload("Items").First(&saved, claim.ID).Error)
					require.Equal(t, float64(100), saved.ClaimAmount)
					require.Equal(t, float64(100), saved.RefundAmount)
					require.Equal(t, float64(100), saved.ReplacementCost)
					require.Len(t, saved.Items, 1)
					require.Equal(t, uint(1), saved.Items[0].Qty)
				}
			}
			require.NoError(t, db.First(product, product.ID).Error)
			require.Equal(t, 5, product.Quantity)
		})
	}
}
