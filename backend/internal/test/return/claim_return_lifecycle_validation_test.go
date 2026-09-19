package returns_test

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	claimController "backend/internal/app/controller/claim"
	returnController "backend/internal/app/controller/return"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	claimRepo "backend/internal/app/repository/claim"
	returnRepo "backend/internal/app/repository/return"
	claimService "backend/internal/app/service/claim"
	returnService "backend/internal/app/service/return"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func lifecycleRequest(t *testing.T, router *gin.Engine, method, path string, payload any) *httptest.ResponseRecorder {
	t.Helper()
	body, err := json.Marshal(payload)
	require.NoError(t, err)
	req := httptest.NewRequest(method, path, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	router.ServeHTTP(response, req)
	return response
}

func TestClaimStatusWriteValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	for _, tc := range []struct {
		name, target, role, status, existing string
		want                                 int
	}{
		{"employee_create_approved", "create", "EMPLOYEE", "APPROVED", "", 403},
		{"employee_create_pending", "create", "EMPLOYEE", "Pending", "", 201},
		{"customer_create", "create", "CUSTOMER", "PENDING", "", 403},
		{"owner_create_invalid_status", "create", "OWNER", "UNKNOWN", "", 400},
		{"employee_header_approval", "header", "EMPLOYEE", "APPROVED", "PENDING", 403},
		{"employee_item_approval", "item", "EMPLOYEE", "approved", "PENDING", 403},
		{"employee_header_rejection", "header", "EMPLOYEE", "REJECTED", "PENDING", 403},
		{"employee_item_rejection", "item", "EMPLOYEE", "REJECTED", "PENDING", 403},
		{"employee_stale_header_pending", "header", "EMPLOYEE", "PENDING", "APPROVED", 200},
		{"employee_stale_item_pending", "item", "EMPLOYEE", "PENDING", "APPROVED", 200},
		{"customer_header_edit", "header", "CUSTOMER", "", "PENDING", 403},
		{"customer_item_edit", "item", "CUSTOMER", "", "PENDING", 403},
		{"unknown_header_status", "header", "OWNER", "UNKNOWN", "PENDING", 400},
		{"unknown_item_status", "item", "OWNER", "UNKNOWN", "PENDING", 400},
		{"unknown_decision_status", "decision", "OWNER", "UNKNOWN", "PENDING", 400},
		{"owner_decision_normalized", "decision", "OWNER", " approved ", "PENDING", 200},
		{"admin_item_approval", "item", "ADMIN", "APPROVED", "PENDING", 200},
	} {
		t.Run(tc.name, func(t *testing.T) {
			db, order, product := newClaimReturnValidationDB(t)
			ctrl := claimController.NewCustomerClaimController(claimService.NewCustomerClaimService(claimRepo.NewCustomerClaimRepository(db), claimRepo.NewSaleOrderLookupRepository(db), nil))
			router := gin.New()
			router.Use(func(c *gin.Context) { c.Set("user_id", float64(1)); c.Set("role", tc.role); c.Next() })
			router.POST("/claims", ctrl.CreateCustomerClaim)
			router.PUT("/claims/:id", ctrl.UpdateCustomerClaim)
			router.PUT("/items/:itemId", ctrl.UpdateCustomerClaimItem)
			router.PUT("/items/:itemId/status", ctrl.UpdateCustomerClaimItemStatus)
			payload := map[string]any{"status": tc.status}
			method, path := http.MethodPost, "/claims"
			var claim entity.CustomerClaim
			if tc.target == "create" {
				payload["original_order_id"] = order.ID
				payload["items"] = []map[string]any{{"product_id": product.ID, "qty": 1, "unit_price": 100, "reason": "Defect"}}
			} else {
				claim = entity.CustomerClaim{OriginalOrderID: order.ID, Status: tc.existing, Items: []entity.CustomerClaimItem{{ProductID: product.ID, Qty: 1, Status: tc.existing, ClaimType: "INSTANT", StockOutIssued: tc.existing == "APPROVED"}}}
				require.NoError(t, db.Create(&claim).Error)
				method, path = http.MethodPut, fmt.Sprintf("/claims/%d", claim.ID)
				if tc.target != "header" {
					path = fmt.Sprintf("/items/%d", claim.Items[0].ID)
				}
				if tc.target == "decision" {
					path += "/status"
				}
			}
			response := lifecycleRequest(t, router, method, path, payload)
			require.Equal(t, tc.want, response.Code, response.Body.String())
			if tc.want == 200 && (tc.target == "decision" || tc.target == "item") && (tc.role == "OWNER" || tc.role == "ADMIN") {
				// Retrying an approval must not issue replacement stock twice.
				retry := lifecycleRequest(t, router, method, path, payload)
				require.Equal(t, 200, retry.Code, retry.Body.String())
				var movements int64
				require.NoError(t, db.Model(&entity.StockMovement{}).Count(&movements).Error)
				require.Equal(t, int64(1), movements)
			}
			var saved []entity.CustomerClaim
			require.NoError(t, db.Preload("Items").Find(&saved).Error)
			if tc.target == "create" && tc.want != 201 {
				require.Empty(t, saved)
			} else {
				require.Len(t, saved, 1)
				wantStatus := tc.existing
				if tc.target == "create" {
					wantStatus = "PENDING"
				}
				if tc.want == 200 && (tc.role == "OWNER" || tc.role == "ADMIN") {
					wantStatus = strings.TrimSpace(strings.ToUpper(tc.status))
				}
				require.Equal(t, wantStatus, strings.ToUpper(saved[0].Status))
				require.Equal(t, wantStatus, strings.ToUpper(saved[0].Items[0].Status))
			}
			require.NoError(t, db.First(product, product.ID).Error)
			wantStock := 5
			if tc.want == 200 && (tc.role == "OWNER" || tc.role == "ADMIN") {
				wantStock = 4
			}
			require.Equal(t, wantStock, product.Quantity)
		})
	}
}

func TestReturnLifecycleValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	for _, status := range []enum.ReturnStatus{enum.ReturnApproved, enum.ReturnRejected, enum.ReturnRefunded} {
		t.Run("cannot_reopen_"+string(status), func(t *testing.T) {
			db := setupReturnTestDB(t)
			ret, _, _ := seedCompletedOrderWithReturn(t, db, 100, 1, 5)
			require.NoError(t, db.Model(ret).Update("status", status).Error)
			ctrl := returnController.NewReturnController(returnService.NewReturnService(returnRepo.NewReturnRepository(db)))
			router := gin.New()
			router.Use(func(c *gin.Context) { c.Set("role", "OWNER"); c.Set("user_id", uint(1)); c.Next() })
			router.PUT("/returns/:id", ctrl.UpdateSalesReturn)
			response := lifecycleRequest(t, router, http.MethodPut, fmt.Sprintf("/returns/%d", ret.ID), map[string]any{"status": "PENDING"})
			require.Equal(t, 409, response.Code, response.Body.String())
			require.NoError(t, db.First(ret, ret.ID).Error)
			require.Equal(t, status, ret.Status)
		})
	}
	for _, changed := range []string{"quantity", "product", "empty"} {
		t.Run("refund_revalidates_"+changed, func(t *testing.T) {
			db := setupReturnTestDB(t)
			ret, _, product := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
			repo := returnRepo.NewReturnRepository(db)
			require.NoError(t, repo.ApproveReturn(ret.ID, 1))
			query := db.Model(&entity.SalesReturnItem{}).Where("sales_return_id = ?", ret.ID)
			switch changed {
			case "quantity":
				require.NoError(t, query.Update("quantity", 6).Error)
			case "product":
				require.NoError(t, query.Update("product_id", 999999).Error)
			case "empty":
				require.NoError(t, query.Delete(&entity.SalesReturnItem{}).Error)
			}
			require.ErrorIs(t, repo.ProcessRefund(ret.ID, 1), returnRepo.ErrReturnQuantityExceedsOrder)
			ctrl := returnController.NewReturnController(returnService.NewReturnService(repo))
			router := gin.New()
			router.Use(func(c *gin.Context) { c.Set("role", "EMPLOYEE"); c.Set("user_id", uint(1)); c.Next() })
			router.POST("/returns/:id/refund", ctrl.ProcessRefund)
			response := lifecycleRequest(t, router, http.MethodPost, fmt.Sprintf("/returns/%d/refund", ret.ID), nil)
			require.Equal(t, 400, response.Code, response.Body.String())
			require.NoError(t, db.First(ret, ret.ID).Error)
			require.Equal(t, enum.ReturnApproved, ret.Status)
			require.NoError(t, db.First(product, product.ID).Error)
			require.Equal(t, 5, product.Quantity)
			var payments int64
			require.NoError(t, db.Model(&entity.Payment{}).Count(&payments).Error)
			require.Zero(t, payments)
		})
	}
	t.Run("repeated_refund_and_stale_edit", func(t *testing.T) {
		db := setupReturnTestDB(t)
		ret, _, product := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
		repo := returnRepo.NewReturnRepository(db)
		require.NoError(t, repo.ApproveReturn(ret.ID, 1))
		stale, err := repo.GetReturnByID(ret.ID)
		require.NoError(t, err)
		require.NoError(t, repo.ProcessRefund(ret.ID, 1))
		require.NoError(t, repo.ProcessRefund(ret.ID, 1))
		stale.RefundAmount = 400
		require.ErrorIs(t, repo.UpdateReturn(stale), returnRepo.ErrReturnAlreadyProcessed)
		require.NoError(t, db.First(product, product.ID).Error)
		require.Equal(t, 7, product.Quantity)
		for _, model := range []any{&entity.Payment{}, &entity.StockMovement{}} {
			var count int64
			require.NoError(t, db.Model(model).Count(&count).Error)
			require.Equal(t, int64(1), count)
		}
		var summary entity.DailySummary
		require.NoError(t, db.First(&summary).Error)
		require.Equal(t, float64(200), summary.ReturnAmount)
		require.NoError(t, db.First(ret, ret.ID).Error)
		require.Equal(t, enum.ReturnRefunded, ret.Status)
		require.Equal(t, float64(200), ret.RefundAmount)
	})
}
