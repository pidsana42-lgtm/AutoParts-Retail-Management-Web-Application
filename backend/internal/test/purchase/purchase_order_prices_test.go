package purchase

import (
	"bytes"
	"context"
	"encoding/json"
	"math"
	"net/http"
	"net/http/httptest"
	"testing"

	controller "backend/internal/app/controller/purchase_orders"
	dto "backend/internal/app/dto/purchase_orders"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	service "backend/internal/app/service/purchase_orders"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

type priceControllerService struct {
	service.PurchaseOrderService
	calls int
}

func (s *priceControllerService) CreatePO(_ context.Context, req *dto.CreatePurchaseOrderRequest, _ uint) (*dto.PurchaseOrderResponse, error) {
	s.calls++
	return &dto.PurchaseOrderResponse{ID: 1, TotalAmount: float64(req.POItems[0].Quantity) * req.POItems[0].UnitPrice}, nil
}
func (s *priceControllerService) UpdatePO(_ context.Context, id uint, _ *dto.UpdatePurchaseOrderRequest, _ uint) (*entity.PO, error) {
	s.calls++
	return &entity.PO{}, nil
}

func TestPOPriceHTTPValidation(t *testing.T) {
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		for _, tc := range []struct {
			name     string
			price    float64
			preorder *uint
			valid    bool
		}{
			{"preorder_zero_estimate", 0, ptr(uint(8)), true},
			{"preorder_positive", 150, ptr(uint(8)), true},
			{"preorder_negative", -1, ptr(uint(8)), false},
			{"normal_zero", 0, nil, false},
			{"normal_positive", 150, nil, true},
			{"normal_negative", -1, nil, false},
			{"zero_preorder_id", 0, ptr(uint(0)), false},
			{"manual_preorder", 0, ptr(uint(8)), true},
			{"missing_product", 150, nil, false},
		} {
			t.Run(method+"/"+tc.name, func(t *testing.T) {
				svc := &priceControllerService{}
				ctrl := controller.NewPOController(svc)
				router := gin.New()
				router.Use(func(c *gin.Context) { c.Set("user_id", float64(1)); c.Next() })
				router.POST("/po/1", ctrl.CreatePO)
				router.PUT("/po/:id", ctrl.UpdatePO)
				item := map[string]any{"product_id": 3, "quantity": 2, "unit_price": tc.price, "pre_order_item_id": tc.preorder}
				if tc.name == "manual_preorder" || tc.name == "missing_product" { item["product_id"] = nil }
				key := "po_items"
				if method == http.MethodPut {
					key = "items"
				}
				body, err := json.Marshal(map[string]any{"supplier_id": 7, "status": "DRAFT", "notes": "estimate", key: []any{item}})
				require.NoError(t, err)
				request := httptest.NewRequest(method, "/po/1", bytes.NewReader(body))
				request.Header.Set("Content-Type", "application/json")
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				if tc.valid {
					want := http.StatusOK
					if method == http.MethodPost {
						want = http.StatusCreated
					}
					require.Equal(t, want, response.Code, response.Body.String())
					require.Equal(t, 1, svc.calls)
				} else {
					require.Equal(t, http.StatusBadRequest, response.Code, response.Body.String())
					require.Zero(t, svc.calls)
				}
			})
		}
	}
}

func TestPOServiceRejectsNonfinitePricesBeforeAnyWrites(t *testing.T) {
	svc := service.NewPOService(nil, nil, nil, nil, nil, nil, nil, nil)
	for _, price := range []float64{math.NaN(), math.Inf(1), math.Inf(-1), -1} {
		_, err := svc.CreatePO(context.Background(), &dto.CreatePurchaseOrderRequest{POItems: []dto.POItemDTO{{UnitPrice: price, PreOrderItemID: ptr(uint(8))}}}, 1)
		require.Error(t, err)
		_, err = svc.UpdatePO(context.Background(), 1, &dto.UpdatePurchaseOrderRequest{Items: []dto.UpdatePOItemRequest{{UnitPrice: price, PreOrderItemID: ptr(uint(8))}}}, 1)
		require.Error(t, err)
	}
}

func TestCreatePOPreservesZeroPreorderEstimate(t *testing.T) {
	var saved *entity.PO
	r := &mockPORepo{
		save:   func(p *entity.PO) error { p.ID = 1; saved = p; return nil },
		reload: func(uint) (*entity.PO, error) { return saved, nil },
	}
	products := &mockProduct{get: func(uint) (*entity.Product, error) { return &entity.Product{Product_Name: "Turbocharger"}, nil }}
	suppliers := &mockSupplier{get: func(uint) (*entity.Supplier, error) { return &entity.Supplier{SupplierName: "Test supplier"}, nil }}
	preorders := &mockPreorder{update: func(ids []uint, status string) error {
		require.Equal(t, []uint{8}, ids)
		require.Equal(t, "RESERVED", status)
		return nil
	}}
	svc := service.NewPOService(r, products, nil, suppliers, preorders, nil, nil, nil)
	response, err := svc.CreatePO(context.Background(), &dto.CreatePurchaseOrderRequest{
		SupplierID: 7, Status: enum.StatusDraft,
		POItems: []dto.POItemDTO{{ProductID: 3, Quantity: 2, UnitPrice: 0, PreOrderItemID: ptr(uint(8))}},
	}, 1)
	require.NoError(t, err)
	require.Zero(t, saved.Total_amount)
	require.Zero(t, saved.PO_Items[0].UnitPrice)
	require.Zero(t, saved.PO_Items[0].SubTotal)
	require.Zero(t, response.TotalAmount)
	require.Equal(t, "พรีออเดอร์", response.POItems[0].OrderType)
}
