package pos_test

import (
	"errors"
	"testing"
	"time"

	posDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	posRepo "backend/internal/app/repository/pos"
	posService "backend/internal/app/service/pos"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// -----------------------------------------------------------------------------
// Mocks & Setup
// -----------------------------------------------------------------------------

type mockSaleRepo struct {
	db                    *gorm.DB
	storeConfig           *entity.StoreConfig
	storeConfigErr        error
	paymentMethods        map[uint]*entity.PaymentMethod
	paymentMethodErr      error
	customerTypes         []entity.CustomerType
	customerTypesErr      error
	searchCustomersResult []entity.Customer
	searchCustomersErr    error
	allPaymentMethods     []entity.PaymentMethod
	allPaymentMethodsErr  error
	createOrderErr        error
	updateOrderErr        error
	deleteItemsErr        error
	existingOrder         *entity.SaleOrder
	existingOrderErr      error
}

var _ posRepo.SaleRepository = (*mockSaleRepo)(nil)

func (m *mockSaleRepo) BeginTransaction() *gorm.DB {
	return m.db.Begin()
}

func (m *mockSaleRepo) CreateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error {
	if m.createOrderErr != nil {
		return m.createOrderErr
	}
	if order.CustomerID != nil && *order.CustomerID == 0 {
		order.CustomerID = nil
	}
	return tx.Omit("Customer").Create(order).Error
}

func (m *mockSaleRepo) GetStoreConfig() (*entity.StoreConfig, error) {
	if m.storeConfigErr != nil {
		return nil, m.storeConfigErr
	}
	if m.storeConfig != nil {
		return m.storeConfig, nil
	}
	return &entity.StoreConfig{
		MaxCredit:            50000.0,
		MaxOverdueDays:       30,
		MaxExtraDiscountRate: 10.0,
		SupervisedPin:        "1234",
	}, nil
}

func (m *mockSaleRepo) GetPaymentMethodByID(id uint) (*entity.PaymentMethod, error) {
	if m.paymentMethodErr != nil {
		return nil, m.paymentMethodErr
	}
	if method, ok := m.paymentMethods[id]; ok {
		return method, nil
	}
	return nil, errors.New("ไม่พบช่องทางการชำระเงินในระบบ")
}

func (m *mockSaleRepo) GetCustomerTypes() ([]entity.CustomerType, error) {
	if m.customerTypesErr != nil {
		return nil, m.customerTypesErr
	}
	return m.customerTypes, nil
}

func (m *mockSaleRepo) SearchCustomers(searchQuery string) ([]entity.Customer, error) {
	if m.searchCustomersErr != nil {
		return nil, m.searchCustomersErr
	}
	return m.searchCustomersResult, nil
}

func (m *mockSaleRepo) GetPaymentMethods() ([]entity.PaymentMethod, error) {
	if m.allPaymentMethodsErr != nil {
		return nil, m.allPaymentMethodsErr
	}
	return m.allPaymentMethods, nil
}

func (m *mockSaleRepo) GetOrderByID(id uint) (*entity.SaleOrder, error) {
	if m.existingOrderErr != nil {
		return nil, m.existingOrderErr
	}
	return m.existingOrder, nil
}

func (m *mockSaleRepo) UpdateOrderWithTx(tx *gorm.DB, order *entity.SaleOrder) error {
	if m.updateOrderErr != nil {
		return m.updateOrderErr
	}
	if order.CustomerID != nil && *order.CustomerID == 0 {
		order.CustomerID = nil
	}
	return tx.Omit("Customer", "PaymentMethod").Save(order).Error
}

func (m *mockSaleRepo) DeleteOrderItemsWithTx(tx *gorm.DB, orderID uint) error {
	if m.deleteItemsErr != nil {
		return m.deleteItemsErr
	}
	return tx.Where("order_id = ?", orderID).Delete(&entity.SaleOrderItem{}).Error
}

func (m *mockSaleRepo) GetOrderByOrderNumber(orderNumber string) (*entity.SaleOrder, error) {
	if m.existingOrderErr != nil {
		return nil, m.existingOrderErr
	}
	if m.existingOrder != nil && m.existingOrder.OrderNumber == orderNumber {
		return m.existingOrder, nil
	}
	return nil, errors.New("record not found")
}

type mockPOSProductRepo struct {
	products map[uint]*entity.Product
	getErr   error
}

var _ posRepo.POSProductRepository = (*mockPOSProductRepo)(nil)

func (m *mockPOSProductRepo) SearchProducts(search string) ([]entity.Product, error) {
	return nil, nil
}

func (m *mockPOSProductRepo) GetProductByID(id uint) (*entity.Product, error) {
	if m.getErr != nil {
		return nil, m.getErr
	}
	if p, ok := m.products[id]; ok {
		// Return copy
		pCopy := *p
		if pCopy.Unit == nil {
			pCopy.Unit = &entity.Unit{Unit_Name: "ชิ้น"}
		}
		return &pCopy, nil
	}
	return nil, errors.New("record not found")
}

func (m *mockPOSProductRepo) UpdateProductWithTx(tx *gorm.DB, product *entity.Product) error {
	if p, ok := m.products[product.ID]; ok {
		p.Quantity = product.Quantity
	}
	return tx.Save(product).Error
}

// testFixture holds the DB, repos, and service for a test
type testFixture struct {
	db          *gorm.DB
	saleRepo    *mockSaleRepo
	productRepo *mockPOSProductRepo
	service     posService.SaleService
}

func newTestFixture(t *testing.T) *testFixture {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.CustomerType{},
		&entity.Customer{},
		&entity.Unit{},
		&entity.Product{},
		&entity.StoreConfig{},
		&entity.PaymentMethod{},
		&entity.SaleOrder{},
		&entity.SaleOrderItem{},
		&entity.Payment{},
		&entity.User{},
	)
	require.NoError(t, err)

	saleRepo := &mockSaleRepo{
		db: db,
		paymentMethods: map[uint]*entity.PaymentMethod{
			1: {Model: gorm.Model{ID: 1}, MethodName: "CASH", IsActive: true, IsCredit: false},
			2: {Model: gorm.Model{ID: 2}, MethodName: "QR_PROMPT_PAY", IsActive: true, IsCredit: false},
			3: {Model: gorm.Model{ID: 3}, MethodName: "CREDIT", IsActive: true, IsCredit: true},
			4: {Model: gorm.Model{ID: 4}, MethodName: "INACTIVE", IsActive: false, IsCredit: false},
		},
	}

	productRepo := &mockPOSProductRepo{
		products: make(map[uint]*entity.Product),
	}

	service := posService.NewSaleService(saleRepo, nil, productRepo)

	return &testFixture{
		db:          db,
		saleRepo:    saleRepo,
		productRepo: productRepo,
		service:     service,
	}
}

// -----------------------------------------------------------------------------
// 1. CreatePOSOrder: Walk-In Customer (ลูกค้าทั่วไป / ขาจร)
// -----------------------------------------------------------------------------

func TestCreatePOSOrder_WalkInCustomer_Cash_WithChange(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Part_Number:     "PART-101",
		Product_Name:    "Brake Pad Toyota",
		Quantity:        50,
		Sale_price:      1000.0,
		Cost_price:      600.0,
		MaxDiscountRate: 5.0,
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:        0, // Walk-in
		CustomerNameTemp:  "สมชาย เข็มกลัด",
		CustomerPhoneTemp: "0812345678",
		PaymentMethodID:   1, // Cash
		BillDiscountType:  "none",
		ReceivedAmount:    2500.0, // Pay 2500 for 2000 total -> 500 change
		Items: []posDto.SaleOrderItemRequest{
			{
				ProductID:     101,
				ProductName:   "Brake Pad Toyota",
				Qty:           2,
				UnitPrice:     1000.0,
				DiscountType:  "none",
				DiscountValue: 0,
			},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.NotEmpty(t, order.OrderNumber)
	assert.Nil(t, order.CustomerID)
	assert.Equal(t, "สมชาย เข็มกลัด", *order.CustomerNameTemp)
	assert.Equal(t, "0812345678", *order.CustomerPhoneTemp)
	assert.Equal(t, enum.OrderStatus("completed"), order.Status)
	assert.Equal(t, enum.PaymentStatus("paid"), order.PaymentStatus)
	assert.Equal(t, 2000.0, order.Subtotal)
	assert.Equal(t, 2000.0, order.TotalAmount)
	assert.Equal(t, 2500.0, order.ReceivedAmount)
	assert.Equal(t, 2000.0, order.PaidAmount)
	assert.Equal(t, 500.0, order.ChangeAmount)
	assert.Equal(t, 0.0, order.BalanceDue)
	require.Len(t, order.Items, 1)

	// Stock deducted
	assert.Equal(t, 48, f.productRepo.products[101].Quantity)

	// Payment record
	var payment entity.Payment
	err = f.db.Where("order_id = ?", order.ID).First(&payment).Error
	require.NoError(t, err)
	assert.Equal(t, 2000.0, payment.Amount)
	assert.Equal(t, 2500.0, payment.ReceivedAmount)
	assert.Equal(t, 500.0, payment.ChangeAmount)
}

func TestCreatePOSOrder_WalkInCustomer_DefaultNameWhenEmpty(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Spark Plug",
		Quantity:        20,
		Sale_price:      150.0,
		MaxDiscountRate: 10.0,
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0,
		CustomerNameTemp: "", // Empty name
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Spark Plug", Qty: 1, UnitPrice: 150.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)
	assert.Equal(t, "ลูกค้าทั่วไป (หน้าร้าน)", *order.CustomerNameTemp)
}

// -----------------------------------------------------------------------------
// 2. CreatePOSOrder: Registered Customer (สมาชิก / อู่)
// -----------------------------------------------------------------------------

func TestCreatePOSOrder_RegisteredCustomer_Success(t *testing.T) {
	f := newTestFixture(t)

	customer := &entity.Customer{
		Model:                gorm.Model{ID: 10},
		CustomerName:         "อู่ช่างพรศักดิ์ เจริญยนต์",
		CustomerTypeID:       2,
		CustomerType:         entity.CustomerType{Model: gorm.Model{ID: 2}, TypeName: "REPAIR_SHOP"},
		CreditLimit:          20000.0,
		PhoneNumber:          "0899999999",
		IdCardNumberCustomer: "1234567890123",
		ShippingAddress:      "กรุงเทพฯ",
		CurrentDebtAmount:    0.0,
		IsDiscountEnabled:    true,
		StandardDiscountRate: 5.0,
	}
	require.NoError(t, f.db.Create(customer).Error)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Brake Fluid",
		Quantity:        10,
		Sale_price:      200.0,
		MaxDiscountRate: 5.0,
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:          10,
		CustomerAddressTemp: "ที่อยู่จัดส่งใหม่ อู่สาขา 2",
		PaymentMethodID:     2, // QR PromptPay
		BillDiscountType:    "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Brake Fluid", Qty: 2, UnitPrice: 200.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.Equal(t, uint(10), *order.CustomerID)
	assert.Equal(t, "อู่ช่างพรศักดิ์ เจริญยนต์", *order.CustomerNameTemp)
	assert.Equal(t, "ที่อยู่จัดส่งใหม่ อู่สาขา 2", order.CustomerAddressTemp)
	assert.Equal(t, 400.0, order.TotalAmount)
	assert.Equal(t, enum.OrderStatus("completed"), order.Status)
	assert.Equal(t, enum.PaymentStatus("paid"), order.PaymentStatus)

	// Address updated on customer in DB
	var dbCust entity.Customer
	err = f.db.First(&dbCust, 10).Error
	require.NoError(t, err)
	assert.Equal(t, "ที่อยู่จัดส่งใหม่ อู่สาขา 2", dbCust.ShippingAddress)
}

func TestCreatePOSOrder_CustomerNotFound(t *testing.T) {
	f := newTestFixture(t)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       999, // Does not exist
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Brake Fluid", Qty: 1, UnitPrice: 200.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ไม่พบข้อมูลลูกค้าในระบบ")
}

// -----------------------------------------------------------------------------
// 3. Product Validation & Stock Checking
// -----------------------------------------------------------------------------

func TestCreatePOSOrder_ProductNotFound(t *testing.T) {
	f := newTestFixture(t)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 888, ProductName: "Non-existent Part", Qty: 1, UnitPrice: 500.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "ไม่พบสินค้า ID 888")
}

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

	// Verify stock was not changed
	assert.Equal(t, 3, f.productRepo.products[101].Quantity)
}

// -----------------------------------------------------------------------------
// 4. Item Discounts & Ceiling Logic (Layer 1 + Layer 2)
// -----------------------------------------------------------------------------

func TestCreatePOSOrder_ItemDiscount_ExceedsAllowedLimit(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Oil Filter",
		Quantity:        20,
		Sale_price:      200.0,
		MaxDiscountRate: 5.0, // Product allows max 5%
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0, // Walk-in (no extra customer discount)
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{
				ProductID:     101,
				ProductName:   "Oil Filter",
				Qty:           1,
				UnitPrice:     200.0,
				DiscountType:  "percentage",
				DiscountValue: 8.0, // Requesting 8% > 5% allowed
			},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "เกินกว่าเกณฑ์สูงสุดที่ยอมให้ลดได้")
}

func TestCreatePOSOrder_ItemDiscount_WithCustomerOntopDiscount_Passes(t *testing.T) {
	f := newTestFixture(t)

	customer := &entity.Customer{
		Model:                gorm.Model{ID: 20},
		CustomerName:         "อู่ VIP รวมช่าง",
		CustomerTypeID:       2,
		CustomerType:         entity.CustomerType{Model: gorm.Model{ID: 2}, TypeName: "REPAIR_SHOP"},
		CreditLimit:          50000.0,
		PhoneNumber:          "0819998888",
		IdCardNumberCustomer: "2345678901234",
		IsDiscountEnabled:    true,
		OntopDiscountRate:    3.0, // +3% on top of product discount
	}
	require.NoError(t, f.db.Create(customer).Error)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Oil Filter",
		Quantity:        20,
		Sale_price:      200.0,
		MaxDiscountRate: 5.0, // 5% + 3% = 8% allowed
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       20,
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{
				ProductID:     101,
				ProductName:   "Oil Filter",
				Qty:           2,
				UnitPrice:     200.0,
				DiscountType:  "percentage",
				DiscountValue: 7.0, // 7% <= 8% allowed -> passes!
			},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	// 200 * 7% = 14 discount per unit, total 28 discount
	// Subtotal stores subtotal after item discounts (400 - 28 = 372)
	assert.Equal(t, 372.0, order.Subtotal)
	assert.Equal(t, 28.0, order.TotalDiscountItems)
	assert.Equal(t, 372.0, order.TotalAmount)
}

func TestCreatePOSOrder_ItemDiscount_AmountType(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Battery",
		Quantity:        10,
		Sale_price:      2000.0,
		MaxDiscountRate: 10.0, // Max 10% (= 200 baht)
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:       0,
		PaymentMethodID:  1,
		BillDiscountType: "none",
		Items: []posDto.SaleOrderItemRequest{
			{
				ProductID:     101,
				ProductName:   "Battery",
				Qty:           1,
				UnitPrice:     2000.0,
				DiscountType:  "amount",
				DiscountValue: 100.0, // 100 baht = 5% <= 10% allowed
			},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	// Subtotal stores subtotal after item discounts (2000 - 100 = 1900)
	assert.Equal(t, 1900.0, order.Subtotal)
	assert.Equal(t, 100.0, order.TotalDiscountItems)
	assert.Equal(t, 1900.0, order.TotalAmount)
}

// -----------------------------------------------------------------------------
// 5. Bill Discount & Ceiling Logic (Layer 3)
// -----------------------------------------------------------------------------

func TestCreatePOSOrder_BillDiscount_ExceedsStoreConfigLimit(t *testing.T) {
	f := newTestFixture(t)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Alternator",
		Quantity:        5,
		Sale_price:      3000.0,
		MaxDiscountRate: 10.0,
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:        0,
		PaymentMethodID:   1,
		BillDiscountType:  "percentage",
		BillDiscountValue: 15.0, // 15% > 10% store config limit
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Alternator", Qty: 1, UnitPrice: 3000.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.Error(t, err)
	assert.Nil(t, order)
	assert.Contains(t, err.Error(), "เกินกว่านโยบายความปลอดภัยของร้านค้า")
}

func TestCreatePOSOrder_BillDiscount_WholesaleCustomer_BypassesLimit(t *testing.T) {
	f := newTestFixture(t)

	wsCustomer := &entity.Customer{
		Model:                gorm.Model{ID: 30},
		CustomerName:         "บจก. ยานยนต์ไทย (ขายส่ง)",
		CustomerTypeID:       3,
		CustomerType:         entity.CustomerType{Model: gorm.Model{ID: 3}, TypeName: "WHOLESALE"},
		CreditLimit:          100000.0,
		PhoneNumber:          "0828887777",
		IdCardNumberCustomer: "3456789012345",
	}
	require.NoError(t, f.db.Create(wsCustomer).Error)

	prod := &entity.Product{
		Model:           gorm.Model{ID: 101},
		Product_Code:    "P101",
		Product_Name:    "Engine Oil Drum",
		Quantity:        5,
		Sale_price:      10000.0,
		MaxDiscountRate: 10.0,
	}
	f.productRepo.products[101] = prod
	require.NoError(t, f.db.Create(prod).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:        30,
		PaymentMethodID:   1,
		BillDiscountType:  "percentage",
		BillDiscountValue: 15.0, // 15% > 10% allowed for WHOLESALE
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Engine Oil Drum", Qty: 1, UnitPrice: 10000.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.Equal(t, 10000.0, order.Subtotal)
	assert.Equal(t, 1500.0, order.DiscountAmount)
	assert.Equal(t, 8500.0, order.TotalAmount)
	require.Len(t, order.Items, 1)
	assert.Equal(t, 1500.0, order.Items[0].AllocatedBillDiscount)
	assert.Equal(t, 8500.0, order.Items[0].NetSubtotal)
}

func TestCreatePOSOrder_BillDiscount_DistributionMultipleItems(t *testing.T) {
	f := newTestFixture(t)

	prod1 := &entity.Product{Model: gorm.Model{ID: 101}, Product_Code: "P101", Product_Name: "Part A", Quantity: 10, Sale_price: 1000.0}
	prod2 := &entity.Product{Model: gorm.Model{ID: 102}, Product_Code: "P102", Product_Name: "Part B", Quantity: 10, Sale_price: 3000.0}
	f.productRepo.products[101] = prod1
	f.productRepo.products[102] = prod2
	require.NoError(t, f.db.Create(prod1).Error)
	require.NoError(t, f.db.Create(prod2).Error)

	req := &posDto.CreateSaleOrderRequest{
		CustomerID:        0,
		PaymentMethodID:   1,
		BillDiscountType:  "amount",
		BillDiscountValue: 200.0, // 200 baht off total 4000 (5%)
		Items: []posDto.SaleOrderItemRequest{
			{ProductID: 101, ProductName: "Part A", Qty: 1, UnitPrice: 1000.0, DiscountType: "none"},
			{ProductID: 102, ProductName: "Part B", Qty: 1, UnitPrice: 3000.0, DiscountType: "none"},
		},
	}

	order, err := f.service.CreatePOSOrder(req, 1)
	require.NoError(t, err)
	require.NotNil(t, order)

	assert.Equal(t, 4000.0, order.Subtotal)
	assert.Equal(t, 200.0, order.DiscountAmount)
	assert.Equal(t, 3800.0, order.TotalAmount)

	require.Len(t, order.Items, 2)
	// Item 1 weight: 1000 / 4000 = 25% -> 50 baht discount
	assert.Equal(t, 50.0, order.Items[0].AllocatedBillDiscount)
	assert.Equal(t, 950.0, order.Items[0].NetSubtotal)
	// Item 2 remainder: 200 - 50 = 150 baht discount
	assert.Equal(t, 150.0, order.Items[1].AllocatedBillDiscount)
	assert.Equal(t, 2850.0, order.Items[1].NetSubtotal)
}

// -----------------------------------------------------------------------------
// 6. Payment Methods & Credit System (เงินเชื่อ)
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// 7. Auxiliary Methods: GetCustomerTypes, SearchCustomers, GetPaymentMethods
// -----------------------------------------------------------------------------

func TestGetCustomerTypes_Success(t *testing.T) {
	f := newTestFixture(t)
	f.saleRepo.customerTypes = []entity.CustomerType{
		{Model: gorm.Model{ID: 1}, TypeName: "GENERAL", TypeLabel: "ทั่วไป"},
		{Model: gorm.Model{ID: 2}, TypeName: "REPAIR_SHOP", TypeLabel: "อู่ซ่อมรถ"},
		{Model: gorm.Model{ID: 3}, TypeName: "WHOLESALE", TypeLabel: "ขายส่ง/บริษัท"},
	}

	types, err := f.service.GetCustomerTypes()
	require.NoError(t, err)
	assert.Len(t, types, 3)
}

func TestSearchCustomers_Success(t *testing.T) {
	f := newTestFixture(t)
	f.saleRepo.searchCustomersResult = []entity.Customer{
		{Model: gorm.Model{ID: 1}, CustomerName: "สมหมาย การยาง", PhoneNumber: "0811111111"},
		{Model: gorm.Model{ID: 2}, CustomerName: "สมคิด ยนต์กิจ", PhoneNumber: "0822222222"},
	}

	results, err := f.service.SearchCustomers("สม")
	require.NoError(t, err)
	require.Len(t, results, 2)
	assert.Equal(t, "สมหมาย การยาง", results[0].CustomerName)
	assert.Equal(t, "สมคิด ยนต์กิจ", results[1].CustomerName)
}

func TestGetPaymentMethods_Success(t *testing.T) {
	f := newTestFixture(t)
	f.saleRepo.allPaymentMethods = []entity.PaymentMethod{
		{Model: gorm.Model{ID: 1}, MethodName: "CASH"},
		{Model: gorm.Model{ID: 2}, MethodName: "QR_PROMPT_PAY"},
	}

	methods, err := f.service.GetPaymentMethods()
	require.NoError(t, err)
	require.Len(t, methods, 2)
	assert.Equal(t, "CASH", methods[0].MethodName)
	assert.Equal(t, "QR_PROMPT_PAY", methods[1].MethodName)
}

// -----------------------------------------------------------------------------
// 8. UpdatePOSOrder
// -----------------------------------------------------------------------------

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
