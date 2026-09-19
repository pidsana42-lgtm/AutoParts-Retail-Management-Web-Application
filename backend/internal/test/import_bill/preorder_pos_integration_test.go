package importbill

import (
	dto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	repo "backend/internal/app/repository/pos"
	pos "backend/internal/app/service/pos"
	receiving "backend/internal/app/service/preorder_receiving"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"testing"
	"time"
)

func receiptPOS(t *testing.T, f receiptFixture) pos.SaleService {
	require.NoError(t, f.db.AutoMigrate(&entity.StoreConfig{}, &entity.PaymentMethod{}, &entity.SaleOrder{}, &entity.SaleOrderItem{}, &entity.Payment{}))
	// SQLite does not decode PostgreSQL's timestamptz column as time.Time.
	// Adapt only the in-memory fixture; keep the production POS entity untouched.
	type sqliteSaleDate struct {
		OrderDate time.Time `gorm:"type:datetime"`
	}
	require.NoError(t, f.db.Table("sale_orders").Migrator().AlterColumn(&sqliteSaleDate{}, "OrderDate"))
	require.NoError(t, f.db.Create(&entity.StoreConfig{MaxExtraDiscountRate: 100}).Error)
	require.NoError(t, f.db.Create(&entity.PaymentMethod{Model: gorm.Model{ID: 1}, MethodName: "CASH", IsActive: true}).Error)
	original := pos.NewSaleService(repo.NewSaleRepository(f.db), nil, repo.NewPOSProductRepository(f.db))
	return receiving.WithReservationGuard(f.db, original)
}
func receiptSaleRequest(f receiptFixture, qty int) *dto.CreateSaleOrderRequest {
	return &dto.CreateSaleOrderRequest{PaymentMethodID: 1, CustomerNameTemp: "Walk-in", BillDiscountType: "none", Items: []dto.SaleOrderItemRequest{{ProductID: f.product.ID, Qty: qty, UnitPrice: 125, DiscountType: "none", SupplierID: &f.supplier.ID}}}
}

func TestPreorderPOS_OriginalDTOUnchangedAndAdapterShowsAvailableStock(t *testing.T) {
	f := receiptSetup(t)
	f.receive(t, "CUSTOMER", f.line(f.customerLine, 4))
	f.receive(t, "SHOP", f.line(f.shopLine, 3))
	original := pos.NewPOSProductService(repo.NewPOSProductRepository(f.db))
	physical, err := original.SearchPOSProducts("")
	require.NoError(t, err)
	require.Equal(t, 7, physical[0].Quantity)
	available, err := receiving.WithAvailableStock(f.db, original).SearchPOSProducts("")
	require.NoError(t, err)
	require.Equal(t, 3, available[0].Quantity)
	require.Equal(t, 3, available[0].Suppliers[0].Quantity)
	f.assertStock(t, 7, 4)
}

func TestPreorderPOS_GuardsRepeatedLinesAndPreservesStockOnFailure(t *testing.T) {
	f := receiptSetup(t)
	f.receive(t, "CUSTOMER", f.line(f.customerLine, 4))
	f.receive(t, "SHOP", f.line(f.shopLine, 3))
	svc := receiptPOS(t, f)
	req := receiptSaleRequest(f, 2)
	req.Items = append(req.Items, req.Items[0])
	_, err := svc.CreatePOSOrder(req, 1)
	require.ErrorContains(t, err, "สต็อกไม่พอขาย")
	f.assertStock(t, 7, 4)
	// A late failure inside the original service also rolls the shared transaction back.
	req = receiptSaleRequest(f, 1)
	req.PaymentMethodID = 999
	_, err = svc.CreatePOSOrder(req, 1)
	require.Error(t, err)
	f.assertStock(t, 7, 4)
}

func TestPreorderPOS_SupplierReservationCannotBeCoveredByAnotherSupplier(t *testing.T) {
	f := receiptSetup(t)
	f.receive(t, "CUSTOMER", f.line(f.customerLine, 4))
	f.receive(t, "SHOP", f.line(f.shopLine, 3))
	require.NoError(t, f.db.Model(&entity.Inventory{}).Where("product_id = ?", f.product.ID).Update("inventory_quantity", 4).Error)
	require.NoError(t, f.db.Create(&entity.Inventory{ProductID: f.product.ID, SupplierID: 999, Inventory_Quantity: 3}).Error)
	_, err := receiptPOS(t, f).CreatePOSOrder(receiptSaleRequest(f, 1), 1)
	require.ErrorContains(t, err, "บริษัทที่เลือกไม่พอขาย")
	f.assertStock(t, 7, 4)
}

func TestPreorderPOS_SaleAndEditUseOneTransactionWithoutChangingPhysicalMeaning(t *testing.T) {
	f := receiptSetup(t)
	f.receive(t, "CUSTOMER", f.line(f.customerLine, 4))
	f.receive(t, "SHOP", f.line(f.shopLine, 3))
	svc := receiptPOS(t, f)
	order, err := svc.CreatePOSOrder(receiptSaleRequest(f, 2), 1)
	require.NoError(t, err)
	require.NotNil(t, order)
	f.assertStock(t, 5, 4)
	require.NoError(t, f.db.Model(order).Update("status", "pending").Error)
	req := &dto.UpdateSaleOrderRequest{PaymentMethodID: 1, BillDiscountType: "none", Items: receiptSaleRequest(f, 3).Items}
	_, err = svc.UpdatePOSOrder(order.OrderNumber, req, 1)
	require.NoError(t, err)
	f.assertStock(t, 4, 4)
	require.NoError(t, f.db.Model(&entity.SaleOrder{}).Where("id = ?", order.ID).Update("status", "pending").Error)
	req.Items[0].Qty = 4
	_, err = svc.UpdatePOSOrder(order.OrderNumber, req, 1)
	require.ErrorContains(t, err, "สต็อกไม่พอขาย")
	f.assertStock(t, 4, 4)
}
