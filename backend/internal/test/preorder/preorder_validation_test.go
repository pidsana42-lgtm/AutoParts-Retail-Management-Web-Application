package preorder

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	controller "backend/internal/app/controller/pre_oder"
	"backend/internal/app/entity"
	repository "backend/internal/app/repository/pre_oder"
	service "backend/internal/app/service/pre_oder"

	"github.com/gin-gonic/gin"
)

// These regression tests exercise the real JSON binder, controller and service.
// The repository records write attempts without touching a database or sending notifications.
type validationAuditRepository struct {
	repository.PreOrderRepository
	writes atomic.Int32
}

func (r *validationAuditRepository) CreatePreOrder(order *entity.PreOrder) error {
	r.writes.Add(1)
	order.ID = 1
	return nil
}

func (*validationAuditRepository) GetLineUserIDByCustomerID(uint) (string, error) {
	return "", nil
}

func (*validationAuditRepository) GetPreOrderByID(uint) (*entity.PreOrder, error) {
	return &entity.PreOrder{CustomerID: 1, Status: "PENDING"}, nil
}

func (r *validationAuditRepository) UpdatePreOrder(*entity.PreOrder) error {
	r.writes.Add(1)
	return nil
}

func (r *validationAuditRepository) CreatePreOrderItem(*entity.PreOrderItem) error {
	r.writes.Add(1)
	return nil
}

func TestPreorderValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	cases := []struct {
		name   string
		change func(map[string]interface{}, map[string]interface{})
		want   int
	}{
		{"valid", func(map[string]interface{}, map[string]interface{}) {}, http.StatusCreated},
		{"missing_type", func(p, _ map[string]interface{}) { delete(p, "pre_order_type") }, http.StatusBadRequest},
		{"missing_status", func(p, _ map[string]interface{}) { delete(p, "status") }, http.StatusBadRequest},
		{"missing_date", func(p, _ map[string]interface{}) { delete(p, "order_date") }, http.StatusBadRequest},
		{"missing_items", func(p, _ map[string]interface{}) { delete(p, "pre_order_items") }, http.StatusBadRequest},
		{"empty_items", func(p, _ map[string]interface{}) { p["pre_order_items"] = []interface{}{} }, http.StatusBadRequest},
		{"zero_quantity", func(_, item map[string]interface{}) { item["quantity"] = 0 }, http.StatusBadRequest},
		{"negative_quantity", func(_, item map[string]interface{}) { item["quantity"] = -1 }, http.StatusBadRequest},
		{"negative_price", func(_, item map[string]interface{}) { item["unit_price"] = -1 }, http.StatusBadRequest},
		{"negative_deposit", func(p, _ map[string]interface{}) { p["deposit_amount"] = -1 }, http.StatusBadRequest},
		{"missing_customer", func(p, _ map[string]interface{}) { delete(p, "customer_id") }, http.StatusBadRequest},
		{"blank_customer", func(p, _ map[string]interface{}) { p["customer_id"] = 0; p["customer_name"] = "   " }, http.StatusBadRequest},
		{"free_item", func(_, item map[string]interface{}) { item["unit_price"] = 0 }, http.StatusCreated},
		{"invalid_second_item", func(p, _ map[string]interface{}) {
			p["pre_order_items"] = append(p["pre_order_items"].([]interface{}), map[string]interface{}{"product_id": 2, "quantity": -1, "unit_price": 100})
		}, http.StatusBadRequest},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			item := map[string]interface{}{"product_id": 1, "quantity": 2, "unit_price": 100}
			payload := map[string]interface{}{
				"pre_order_type": "LINE", "customer_id": 1, "status": "PENDING",
				"order_date": "2026-09-17T10:00:00Z", "deposit_amount": 0,
				"pre_order_items": []interface{}{item},
			}
			tc.change(payload, item)
			body, err := json.Marshal(payload)
			if err != nil {
				t.Fatal(err)
			}
			repo := &validationAuditRepository{}
			router := gin.New()
			router.POST("/preorders", controller.NewPreOrderController(service.NewPreOrderService(repo), nil).CreatePreOrder)
			request := httptest.NewRequest(http.MethodPost, "/preorders", bytes.NewReader(body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != tc.want {
				t.Errorf("HTTP status = %d, want %d; write attempts = %d; response = %s", response.Code, tc.want, repo.writes.Load(), response.Body.String())
			}
			if tc.want == http.StatusBadRequest && repo.writes.Load() != 0 {
				t.Errorf("invalid input reached repository: %d write attempts", repo.writes.Load())
			}
		})
	}
}

func TestPreorderUpdateAndItemValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	for _, tc := range []struct {
		name, method, path, body string
		want                     int
	}{
		{"status_only_update", http.MethodPut, "/preorders/1", `{"status":"CANCELLED"}`, 200},
		{"zero_deposit_update", http.MethodPut, "/preorders/1", `{"deposit_amount":0}`, 200},
		{"negative_deposit_update", http.MethodPut, "/preorders/1", `{"deposit_amount":-1}`, 400},
		{"empty_items_update", http.MethodPut, "/preorders/1", `{"pre_order_items":[]}`, 400},
		{"zero_quantity_update", http.MethodPut, "/preorders/1", `{"pre_order_items":[{"product_id":1,"quantity":0,"unit_price":100}]}`, 400},
		{"negative_quantity_update", http.MethodPut, "/preorders/1", `{"pre_order_items":[{"product_id":1,"quantity":-1,"unit_price":100}]}`, 400},
		{"negative_price_update", http.MethodPut, "/preorders/1", `{"pre_order_items":[{"product_id":1,"quantity":1,"unit_price":-1}]}`, 400},
		{"missing_customer_update", http.MethodPut, "/preorders/1", `{"customer_id":0}`, 400},
		{"blank_customer_update", http.MethodPut, "/preorders/1", `{"customer_id":0,"customer_name":"   "}`, 400},
		{"nested_item_without_parent_id", http.MethodPut, "/preorders/1", `{"pre_order_items":[{"product_id":1,"quantity":1,"unit_price":0}]}`, 200},
		{"standalone_item_requires_parent", http.MethodPost, "/items", `{"product_id":1,"quantity":1,"unit_price":0}`, 400},
		{"standalone_item_negative_quantity", http.MethodPost, "/items", `{"pre_order_id":1,"product_id":1,"quantity":-1,"unit_price":0}`, 400},
		{"standalone_free_item", http.MethodPost, "/items", `{"pre_order_id":1,"product_id":1,"quantity":1,"unit_price":0}`, 201},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &validationAuditRepository{}
			ctrl := controller.NewPreOrderController(service.NewPreOrderService(repo), nil)
			router := gin.New()
			router.PUT("/preorders/:id", ctrl.UpdatePreOrder)
			router.POST("/items", ctrl.CreatePreOrderItem)
			req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body))
			req.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, req)
			if response.Code != tc.want {
				t.Fatalf("status = %d, want %d; body = %s", response.Code, tc.want, response.Body.String())
			}
			wantWrites := int32(1)
			if tc.want == http.StatusBadRequest {
				wantWrites = 0
			}
			if got := repo.writes.Load(); got != wantWrites {
				t.Errorf("write attempts = %d, want %d", got, wantWrites)
			}
		})
	}
}
