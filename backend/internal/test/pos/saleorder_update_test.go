package pos_test

import (
	"errors"
	"testing"
	"time"

	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	"backend/internal/app/enum"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// =============================================================================
// UpdatePOSOrder & Stock Reversal Tests
// =============================================================================

func TestUpdatePOSOrder_NotFound(t *testing.T) {
	f := newTestFixture(t)
	f.saleRepo.existingOrderErr = errors.New("not found")

	req := &posDto.UpdateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  1,
		BillDiscountType: "none",
	}

	order, err := f.service.UpdatePOSOrder("INV-NONEXISTENT", req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ไม่พบรายการสั่งซื้อเลขที่")
}

func TestUpdatePOSOrder_NotPending_CannotEdit(t *testing.T) {
	f := newTestFixture(t)
	f.saleRepo.existingOrder = &entity.SaleOrder{
		Model:       gorm.Model{ID: 1},
		OrderNumber: "INV2601010001",
		Status:      enum.OrderStatus("completed"),
		TotalAmount: 1000.0,
	}

	req := &posDto.UpdateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  1,
		BillDiscountType: "none",
	}

	order, err := f.service.UpdatePOSOrder("INV2601010001", req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ไม่สามารถแก้ไขรายการสั่งซื้อที่ทำรายการสำเร็จไปแล้วได้")
}

func TestUpdatePOSOrder_Success_RevertsOldStockAndDeductsNewStock(t *testing.T) {
	f := newTestFixture(t)

	// Old product (initially was sold 2 -> currently in warehouse has 48)
	prodOld := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Old Part",
		Quantity:        48,
		Sale_price:      500.0,
		MaxDiscountRate: 10.0,
	}
	f.productRepo.products[101] = prodOld
	require.NoError(t, f.db.Create(prodOld).Error)

	// New product (warehouse has 20)
	prodNew := &entity.Product{
		Model:           gorm.Model{ID: 102},
		Product_Code:    "P102",
		Product_Name:    "New Part",
		Quantity:        20,
		Sale_price:      800.0,
		MaxDiscountRate: 10.0,
	}
	f.productRepo.products[102] = prodNew
	require.NoError(t, f.db.Create(prodNew).Error)

	pmID := uint(1)
	existingOrder := &entity.SaleOrder{
		Model:           gorm.Model{ID: 5},
		OrderNumber:     "INV2601010005",
		OrderDate:       time.Now(),
		CreatedByID:     1,
		PaymentMethodID: &pmID,
		PaymentMethod:   &entity.PaymentMethod{Model: gorm.Model{ID: 1}, MethodName: "CASH"},
		Status:          enum.OrderStatus("pending"),
		PaymentStatus:   enum.PaymentStatus("unpaid"),
		Subtotal:        1000.0,
		TotalAmount:     1000.0,
		Items: []entity.SaleOrderItem{
			{OrderID: 5, ProductID: 101, Qty: 2, UnitPrice: 500.0, Subtotal: 1000.0},
		},
	}
	f.saleRepo.existingOrder = existingOrder
	require.NoError(t, f.db.Create(existingOrder).Error)

	updateReq := &posDto.UpdateSaleOrderRequest{
		CustomerID:       0,
		CustomerNameTemp: "ลูกค้าแก้บิล",
		PaymentMethodID:  1, // Cash
		BillDiscountType: "none",
		ReceivedAmount:   800.0,
		Items: []posDto.SaleOrderItemRequest{
			{
				ProductID:     102,
				ProductName:   "New Part",
				Qty:           1,
				UnitPrice:     800.0,
				DiscountType:  "none",
				DiscountValue: 0,
			},
		},
	}

	updatedOrder, err := f.service.UpdatePOSOrder("INV2601010005", updateReq, 2)
	require.NoError(t, err)
	require.NotNil(t, updatedOrder)

	assert.Equal(t, 800.0, updatedOrder.TotalAmount)
	assert.Equal(t, enum.OrderStatus("completed"), updatedOrder.Status)
	assert.Equal(t, enum.PaymentStatus("paid"), updatedOrder.PaymentStatus)

	// Verify old product stock was REVERTED (48 + 2 = 50)
	assert.Equal(t, 50, f.productRepo.products[101].Quantity)

	// Verify new product stock was DEDUCTED (20 - 1 = 19)
	assert.Equal(t, 19, f.productRepo.products[102].Quantity)
}
