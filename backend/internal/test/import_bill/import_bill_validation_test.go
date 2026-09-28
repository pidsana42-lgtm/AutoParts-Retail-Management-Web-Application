package importbill

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	controller "backend/internal/app/controller/import_data"
	dto "backend/internal/app/dto/import_data"
	"backend/internal/app/enum"
	service "backend/internal/app/service/import_data"
	"github.com/gin-gonic/gin"
)

type billValidationService struct {
	service.ImportBillService
	writes int
}

func (s *billValidationService) ConfirmBillImport(uint, dto.ConfirmBillImportDTO, string) (dto.ConfirmBillImportResponseDTO, error) {
	s.writes++
	return dto.ConfirmBillImportResponseDTO{}, nil
}

func (s *billValidationService) UpdateBill(uint, dto.ConfirmBillImportDTO, string) (dto.BillResponseDTO, error) {
	s.writes++
	return dto.BillResponseDTO{}, nil
}

// Check both routes so edits cannot bypass the validation applied on initial receipt.
// The HTTP integration suite separately verifies persistence and stock effects.
func TestBillRequestValidation(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })
	for _, method := range []string{http.MethodPost, http.MethodPut} {
		t.Run(method, func(t *testing.T) {
			for _, tc := range []struct {
				name   string
				change func(map[string]any, map[string]any)
				valid  bool
			}{
				{"valid", func(map[string]any, map[string]any) {}, true},
				{"manual_without_supplier_code", func(_, i map[string]any) { delete(i, "company_product_code") }, true},
				{"free_item", func(_, i map[string]any) { i["price_per_unit"] = 0; i["net_amount"] = 0; i["is_freebie"] = true }, true},
				{"missing_items", func(p, _ map[string]any) { delete(p, "items") }, false},
				{"null_items", func(p, _ map[string]any) { p["items"] = nil }, false},
				{"empty_items", func(p, _ map[string]any) { p["items"] = []any{} }, false},
				{"missing_name", func(_, i map[string]any) { delete(i, "company_product_name") }, false},
				{"zero_quantity", func(_, i map[string]any) { i["order_quantity"] = 0 }, false},
				{"negative_quantity", func(_, i map[string]any) { i["order_quantity"] = -1 }, false},
				{"negative_price", func(_, i map[string]any) { i["price_per_unit"] = -1 }, false},
				{"zero_conversion", func(_, i map[string]any) { i["conversion_factor"] = 0 }, false},
				{"negative_conversion", func(_, i map[string]any) { i["conversion_factor"] = -1 }, false},
				{"negative_discount", func(_, i map[string]any) { i["discount_amount"] = -1 }, false},
				{"negative_net", func(_, i map[string]any) { i["net_amount"] = -1 }, false},
				{"invalid_second_item", func(p, _ map[string]any) {
					p["items"] = append(p["items"].([]any), map[string]any{"order_quantity": -1})
				}, false},
			} {
				t.Run(tc.name, func(t *testing.T) {
					item := map[string]any{
						"item_sequence": 1, "company_product_code": "TEST-001", "company_product_name": "Filter",
						"product_id": 1, "order_quantity": 2, "unit": "piece", "conversion_factor": 1,
						"price_per_unit": 100, "net_amount": 200,
					}
					payload := map[string]any{
						"bill":  map[string]any{"bill_no": "VALIDATION-TEST", "due_date": "2026-09-30", "receive_date": "2026-09-17", "total_amount": 200},
						"items": []any{item},
					}
					tc.change(payload, item)
					body, err := json.Marshal(payload)
					if err != nil {
						t.Fatal(err)
					}
					svc := &billValidationService{}
					ctrl := controller.NewBillController(svc)
					router := gin.New()
					router.Use(func(c *gin.Context) { c.Set("role", string(enum.RoleOwner)); c.Next() })
					router.POST("/bills/:id", ctrl.ConfirmBillImport)
					router.PUT("/bills/:id", ctrl.UpdateBill)
					req := httptest.NewRequest(method, "/bills/1", bytes.NewReader(body))
					req.Header.Set("Content-Type", "application/json")
					response := httptest.NewRecorder()
					router.ServeHTTP(response, req)
					want, writes := http.StatusBadRequest, 0
					if tc.valid {
						want, writes = http.StatusOK, 1
						if method == http.MethodPost {
							want = http.StatusCreated
						}
					}
					if response.Code != want || svc.writes != writes {
						t.Errorf("HTTP = %d, want %d; service writes = %d, want %d; body = %s", response.Code, want, svc.writes, writes, response.Body.String())
					}
				})
			}
		})
	}
}
