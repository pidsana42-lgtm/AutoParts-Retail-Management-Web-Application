package pos_test

import (
	"testing"

	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	"backend/internal/app/enum"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// =============================================================================
// 1. Database Transaction Rollback (ACID / Stock Rollback on Error)
// =============================================================================

func TestCreatePOSOrder_OutOfStock_RollbackStock(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Shock Absorber",
		Quantity:        3, // Only 3 in stock
		Sale_price:      1500.0,
		MaxDiscountRate: 5.0,
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Shock Absorber", Qty: 5, UnitPrice: 1500.0, DiscountType: "none"}, // Asking for 5
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "สต็อกไม่พอขาย (เหลือ 3 ชิ้น)")

	// Verify stock was not changed (Rollback verified)
	assert.Equal(t, 3, f.productRepo.products[101].Quantity)
}

// =============================================================================
// 2. Payment Method Transactions (Validation & Status)
// =============================================================================

func TestCreatePOSOrder_PaymentMethod_NotFound(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{Model: gorm.Model{ID: 101}, Product_Code: "P101", Product_Name: "Wiper", Quantity: 5, Sale_price: 100.0}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  999, // Does not exist
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Wiper", Qty: 1, UnitPrice: 100.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ไม่พบช่องทางการชำระเงินในระบบ")
}

func TestCreatePOSOrder_PaymentMethod_Inactive(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{Model: gorm.Model{ID: 101}, Product_Code: "P101", Product_Name: "Wiper", Quantity: 5, Sale_price: 100.0}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  4, // INACTIVE
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Wiper", Qty: 1, UnitPrice: 100.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ถูกปิดใช้งานในขณะนี้")
}

// =============================================================================
// 3. Credit Transactions (ซื้อเชื่อ / วงเงินเครดิต / อัปเดตยอดหนี้)
// =============================================================================

func TestCreatePOSOrder_Credit_WalkInCustomer_Forbidden(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{Model: gorm.Model{ID: 101}, Product_Code: "P101", Product_Name: "Wiper", Quantity: 5, Sale_price: 100.0}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0, // Walk-in
		PaymentMethodID:  3, // Credit
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Wiper", Qty: 1, UnitPrice: 100.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ลูกค้าทั่วไป/ขาจร ไม่สามารถเลือกชำระแบบซื้อเชื่อได้")
}

func TestCreatePOSOrder_Credit_ExceedsCreditLimit(t *testing.T) {
	f := newTestFixture(t)

	customer := &entity.Customer{
		Model:                gorm.Model{ID: 10},
		CustomerName:         "อู่หนี้ท่วม",
		CustomerTypeID:       2,
		CustomerType:         entity.CustomerType{Model: gorm.Model{ID: 2}, TypeName: "REPAIR_SHOP"},
		CreditLimit:          5000.0,
		CurrentDebtAmount:    4500.0, // Remaining credit is 500
		PhoneNumber:          "0814445555",
		IdCardNumberCustomer: "4567890123456",
	}
	require.NoError(t, f.db.Create(customer).Error)

	prod := &entity.Product{Model: gorm.Model{ID: 101}, Product_Code: "P101", Product_Name: "Tire", Quantity: 5, Sale_price: 1000.0}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       10,
		PaymentMethodID:  3, // Credit
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Tire", Qty: 1, UnitPrice: 1000.0, DiscountType: "none"}, // Order = 1000 > 500
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "วงเงินเครดิตไม่เพียงพอ")
}

func TestCreatePOSOrder_Credit_Success_UpdatesCustomerDebt(t *testing.T) {
	f := newTestFixture(t)

	customer := &entity.Customer{
		Model:                gorm.Model{ID: 10},
		CustomerName:         "อู่เครดิตดี",
		CustomerTypeID:       2,
		CustomerType:         entity.CustomerType{Model: gorm.Model{ID: 2}, TypeName: "REPAIR_SHOP"},
		CreditLimit:          20000.0,
		CurrentDebtAmount:    2000.0,
		PhoneNumber:          "0816667777",
		IdCardNumberCustomer: "5678901234567",
	}
	require.NoError(t, f.db.Create(customer).Error)

	prod := &entity.Product{Model: gorm.Model{ID: 101}, Product_Code: "P101", Product_Name: "Brake Disc", Quantity: 10, Sale_price: 3000.0}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       10,
		PaymentMethodID:  3, // Credit
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Brake Disc", Qty: 1, UnitPrice: 3000.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.Equal(t, enum.OrderStatus("completed"), order.Status)
	assert.Equal(t, enum.PaymentStatus("unpaid"), order.PaymentStatus)
	assert.Equal(t, 0.0, order.PaidAmount)
	assert.Equal(t, 3000.0, order.BalanceDue)
	assert.NotNil(t, order.DueDate)

	// Verify customer's CurrentDebtAmount updated in DB (2000 + 3000 = 5000)
	var updatedCust entity.Customer
	err = f.db.First(&updatedCust, 10).Error
	require.NoError(t, err)
	assert.Equal(t, 5000.0, updatedCust.CurrentDebtAmount)

	// No Payment record for credit
	var count int64
	f.db.Model(&entity.Payment{}).Where("order_id = ?", order.ID).Count(&count)
	assert.Equal(t, int64(0), count)
}
