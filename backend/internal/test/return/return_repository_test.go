package returns_test

import (
	"database/sql/driver"
	"testing"
	"time"

	"backend/internal/app/entity"
	"backend/internal/app/enum"
	returnRepo "backend/internal/app/repository/return"

	gosqlite "github.com/glebarez/go-sqlite"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// -----------------------------------------------------------------------------
// ทดสอบ ApproveReturn/ProcessRefund ตรงๆ ผ่าน sqlite in-memory (ไม่ mock repo)
// เพราะ applyApprovedReturn / updateDailySummaryForRefund เป็น unexported function
// ที่มี business rule จริง (เพดานเงินคืน, คำนวณสรุปยอดรายวันใหม่) แต่เทสเดิมทั้งหมด mock
// repository ไว้ทำให้ไม่เคยถูกรันจริงเลยสักครั้ง
// -----------------------------------------------------------------------------

// sqlite ไม่มีฟังก์ชัน GREATEST() ของ Postgres ที่ ProcessRefund ใช้ตอนตัดหนี้ค้างชำระ
func init() {
	toFloat := func(v driver.Value) float64 {
		switch n := v.(type) {
		case int64:
			return float64(n)
		case float64:
			return n
		default:
			return 0
		}
	}
	_ = gosqlite.RegisterScalarFunction("GREATEST", 2, func(_ *gosqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
		a, b := toFloat(args[0]), toFloat(args[1])
		if a > b {
			return a, nil
		}
		return b, nil
	})
}

func setupReturnTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	require.NoError(t, db.AutoMigrate(
		&entity.SalesReturn{},
		&entity.SalesReturnItem{},
		&entity.SaleOrder{},
		&entity.SaleOrderItem{},
		&entity.Product{},
		&entity.StockMovement{},
		&entity.Payment{},
		&entity.PaymentMethod{},
		&entity.Customer{},
		&entity.CustomerType{},
		&entity.DailySummary{},
		&entity.CustomerClaim{},
		&entity.CustomerClaimItem{},
	))

	// sale_orders.order_date ถูก tag เป็น gorm:"type:timestamptz" (ของ Postgres) ตรงๆ ซึ่ง sqlite
	// เก็บไว้เป็น declared type แปลกๆ ที่ driver ไม่รู้จักว่าเป็นวันที่ ทำให้ Scan กลับเป็น time.Time
	// ไม่ได้ ("unsupported Scan ... into type *time.Time") ต้องแก้ column type ให้เป็น datetime ที่
	// sqlite รู้จักก่อน (ตารางยังว่างอยู่ตอนนี้ ไม่มีข้อมูลให้เสีย)
	require.NoError(t, db.Exec("DROP INDEX IF EXISTS idx_sale_orders_created_at_id").Error)
	require.NoError(t, db.Exec("ALTER TABLE sale_orders DROP COLUMN order_date").Error)
	require.NoError(t, db.Exec("ALTER TABLE sale_orders ADD COLUMN order_date datetime NOT NULL DEFAULT CURRENT_TIMESTAMP").Error)

	// id เรียงตาม refundPaymentMethodID: 1=CASH, 2=TRANSFER/QR, 3=STORE_CREDIT
	require.NoError(t, db.Create(&entity.PaymentMethod{MethodName: enum.PaymentMethodCash}).Error)
	require.NoError(t, db.Create(&entity.PaymentMethod{MethodName: enum.PaymentMethodQR}).Error)
	require.NoError(t, db.Create(&entity.PaymentMethod{MethodName: enum.PaymentMethodCredit, IsCredit: true}).Error)

	return db
}

// seedCompletedOrderWithReturn: เตรียมออเดอร์ที่ขายเสร็จแล้ว 1 ใบ พร้อมสินค้า 1 รายการ (qty เดิม)
// และใบคืนสินค้าที่รออนุมัติ (PENDING) อ้างอิงออเดอร์นั้น
func seedCompletedOrderWithReturn(t *testing.T, db *gorm.DB, refundAmount float64, returnQty, orderedQty int) (*entity.SalesReturn, *entity.SaleOrder, *entity.Product) {
	// ใส่ Product_Code ไว้ล่วงหน้าเพื่อข้าม BeforeCreate hook ที่ auto-generate รหัสจาก Category
	// (ไม่ได้ seed ตาราง categories ในเทสชุดนี้ เพราะไม่เกี่ยวกับ business rule ที่กำลังทดสอบ)
	product := entity.Product{Product_Code: "P-TEST-1", Product_Name: "สินค้าทดสอบ", Cost_price: 100, Sale_price: 150, Quantity: 5}
	require.NoError(t, db.Create(&product).Error)

	cashMethodID := uint(1)
	order := entity.SaleOrder{
		OrderNumber:     "SO-TEST-1",
		OrderDate:       time.Now(),
		CreatedByID:     1,
		Status:          enum.OrderCompleted,
		PaymentStatus:   enum.PaymentPaid,
		PaymentMethodID: &cashMethodID,
		TotalAmount:     500,
	}
	require.NoError(t, db.Create(&order).Error)

	orderItem := entity.SaleOrderItem{
		OrderNumber: order.OrderNumber,
		OrderID:     order.ID,
		ProductID:   product.ID,
		PartNumber:  "P-1",
		ProductName: "สินค้าทดสอบ",
		Qty:         orderedQty,
		Unit:        "ชิ้น",
		UnitPrice:   100,
	}
	require.NoError(t, db.Create(&orderItem).Error)

	salesReturn := entity.SalesReturn{
		ReturnNumber:    "RTN-TEST-1",
		OriginalOrderID: order.ID,
		ReturnDate:      time.Now(),
		Status:          enum.ReturnPending,
		Reason:          "สินค้าชำรุด",
		RefundAmount:    refundAmount,
		RefundMethod:    "CASH",
		RequestedAt:     time.Now(),
		CreatedBy:       1,
	}
	require.NoError(t, db.Create(&salesReturn).Error)

	returnItem := entity.SalesReturnItem{
		SalesReturnID: salesReturn.ID,
		ProductID:     product.ID,
		Quantity:      returnQty,
		UnitPrice:     100,
		Subtotal:      float64(returnQty) * 100,
	}
	require.NoError(t, db.Create(&returnItem).Error)

	return &salesReturn, &order, &product
}

func TestApproveReturn_Success_UpdatesReturnAndOrderStatus(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, order, _ := seedCompletedOrderWithReturn(t, db, 200, 2, 5)

	err := repo.ApproveReturn(salesReturn.ID, 42)
	require.NoError(t, err)

	var updated entity.SalesReturn
	require.NoError(t, db.First(&updated, salesReturn.ID).Error)
	require.Equal(t, enum.ReturnApproved, updated.Status)
	require.NotNil(t, updated.ApprovedAt)
	require.NotNil(t, updated.ApprovedBy)
	require.Equal(t, uint(42), *updated.ApprovedBy)

	var updatedOrder entity.SaleOrder
	require.NoError(t, db.First(&updatedOrder, order.ID).Error)
	require.Equal(t, enum.OrderReturned, updatedOrder.Status)
}

func TestApproveReturn_RefundExceedsOrderTotal_RollsBackWithoutChanges(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	// TotalAmount ของออเดอร์ (seed ไว้คงที่ 500) แต่ refund ขอคืน 600 -> เกินยอดบิล
	salesReturn, order, _ := seedCompletedOrderWithReturn(t, db, 600, 2, 5)

	err := repo.ApproveReturn(salesReturn.ID, 1)
	require.ErrorIs(t, err, returnRepo.ErrRefundAmountExceedsOrder)

	var unchanged entity.SalesReturn
	require.NoError(t, db.First(&unchanged, salesReturn.ID).Error)
	require.Equal(t, enum.ReturnPending, unchanged.Status, "ต้อง rollback ทั้ง transaction ไม่ใช่ค้างสถานะครึ่งๆ กลางๆ")

	var unchangedOrder entity.SaleOrder
	require.NoError(t, db.First(&unchangedOrder, order.ID).Error)
	require.Equal(t, enum.OrderCompleted, unchangedOrder.Status)
}

func TestApproveReturn_QuantityExceedsOrder_ReturnsError(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	// ขอคืน 10 ชิ้น แต่ในบิลขายจริงมีแค่ 5 ชิ้น
	salesReturn, _, _ := seedCompletedOrderWithReturn(t, db, 200, 10, 5)

	err := repo.ApproveReturn(salesReturn.ID, 1)
	require.ErrorIs(t, err, returnRepo.ErrReturnQuantityExceedsOrder)
}

func TestApproveReturn_OrderNotCompleted_ReturnsError(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, order, _ := seedCompletedOrderWithReturn(t, db, 200, 2, 5)

	require.NoError(t, db.Model(&entity.SaleOrder{}).Where("id = ?", order.ID).Update("status", enum.OrderPending).Error)

	err := repo.ApproveReturn(salesReturn.ID, 1)
	require.ErrorIs(t, err, returnRepo.ErrOrderNotCompleted)
}

func TestApproveReturn_AlreadyApproved_IsIdempotent(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, _, _ := seedCompletedOrderWithReturn(t, db, 200, 2, 5)

	require.NoError(t, repo.ApproveReturn(salesReturn.ID, 1))
	// เรียกซ้ำอีกครั้ง ต้องไม่ error และไม่พยายาม apply ซ้ำ
	require.NoError(t, repo.ApproveReturn(salesReturn.ID, 99))

	var updated entity.SalesReturn
	require.NoError(t, db.First(&updated, salesReturn.ID).Error)
	require.Equal(t, uint(1), *updated.ApprovedBy, "เรียกซ้ำต้องไม่เปลี่ยน approved_by จากรอบแรก")
}

func TestProcessRefund_Success_CreatesNewDailySummaryRow(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, order, product := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
	require.NoError(t, repo.ApproveReturn(salesReturn.ID, 1))

	err := repo.ProcessRefund(salesReturn.ID, 7)
	require.NoError(t, err)

	var updatedReturn entity.SalesReturn
	require.NoError(t, db.First(&updatedReturn, salesReturn.ID).Error)
	require.Equal(t, enum.ReturnRefunded, updatedReturn.Status)
	require.NotNil(t, updatedReturn.RefundedAt)

	var updatedProduct entity.Product
	require.NoError(t, db.First(&updatedProduct, product.ID).Error)
	require.Equal(t, 7, updatedProduct.Quantity, "สต๊อกต้องถูกคืนกลับ (5 เดิม + คืน 2)")

	var movementCount int64
	require.NoError(t, db.Model(&entity.StockMovement{}).Where("product_id = ? AND movement_type = ?", product.ID, "RETURN").Count(&movementCount).Error)
	require.Equal(t, int64(1), movementCount)

	var payment entity.Payment
	require.NoError(t, db.Where("order_id = ?", order.ID).First(&payment).Error)
	require.Equal(t, -200.0, payment.Amount, "เงินคืนต้องบันทึกเป็นค่าติดลบในตาราง payments")

	var summary entity.DailySummary
	require.NoError(t, db.First(&summary).Error)
	require.Equal(t, 200.0, summary.ReturnAmount)
	require.Equal(t, -200.0, summary.CashAmount, "ออเดอร์ต้นทางจ่ายเงินสด ต้องหักออกจาก cash_amount")
	require.Equal(t, -200.0, summary.WalkinCustomerAmount, "ไม่มีลูกค้าผูกกับออเดอร์ -> นับเป็นลูกค้าทั่วไป (walk-in)")
}

func TestProcessRefund_Success_UpdatesExistingDailySummaryRow(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, order, _ := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
	require.NoError(t, repo.ApproveReturn(salesReturn.ID, 1))

	saleDate := order.OrderDate
	summaryDate := time.Date(saleDate.Year(), saleDate.Month(), saleDate.Day(), 0, 0, 0, 0, saleDate.Location())
	existing := entity.DailySummary{
		SummaryDate:  summaryDate,
		TotalRevenue: 500,
		ReturnAmount: 50, // มีบิลอื่นถูกคืนไปแล้วก่อนหน้าในวันเดียวกัน
		NetRevenue:   450,
		CashAmount:   500,
	}
	require.NoError(t, db.Create(&existing).Error)

	require.NoError(t, repo.ProcessRefund(salesReturn.ID, 7))

	var updated entity.DailySummary
	require.NoError(t, db.First(&updated, existing.ID).Error)
	require.Equal(t, 250.0, updated.ReturnAmount, "ต้องบวกเพิ่มจากยอดคืนเดิม (50 + 200)")
	require.Equal(t, 500.0-250.0, updated.NetRevenue, "net revenue ต้องคำนวณใหม่จาก total - return สะสม")
	require.Equal(t, 300.0, updated.CashAmount, "ต้องหักยอดคืนออกจาก cash_amount เดิม (500 - 200) ไม่ใช่ทับค่าใหม่ทั้งหมด")
}

func TestProcessRefund_RefundExceedsOrderTotal_ReturnsError(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, _, _ := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
	require.NoError(t, repo.ApproveReturn(salesReturn.ID, 1))

	// แก้ยอดคืนเป็นเกินยอดบิลทีหลัง approve แล้ว (จำลองแก้ไขข้อมูลไม่ตรง)
	require.NoError(t, db.Model(&entity.SalesReturn{}).Where("id = ?", salesReturn.ID).Update("refund_amount", 9999).Error)

	err := repo.ProcessRefund(salesReturn.ID, 1)
	require.ErrorIs(t, err, returnRepo.ErrRefundAmountExceedsOrder)
}

func TestProcessRefund_NotApproved_ReturnsError(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	salesReturn, _, _ := seedCompletedOrderWithReturn(t, db, 200, 2, 5) // ยังไม่ approve

	err := repo.ProcessRefund(salesReturn.ID, 1)
	require.ErrorIs(t, err, returnRepo.ErrReturnNotApproved)
}

// TestCreateReturn_AfterPriorReturnRefunded_AllowsReturningRemainingUnits: ออเดอร์ซื้อ 5 ชิ้น
// คืนไปแล้ว 2 ชิ้นและได้รับเงินคืนสำเร็จ (REFUNDED) ต้องยังคืนอีก 3 ชิ้นที่เหลือของออเดอร์เดียวกันได้
// (บั๊กเดิม: ใบคืนที่ REFUNDED แล้วถูกนับเป็น "ยังค้างอยู่" บล็อกไม่ให้คืนของที่เหลือได้อีกเลย)
func TestCreateReturn_AfterPriorReturnRefunded_AllowsReturningRemainingUnits(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	firstReturn, order, product := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
	require.NoError(t, repo.ApproveReturn(firstReturn.ID, 1))
	require.NoError(t, repo.ProcessRefund(firstReturn.ID, 1))

	secondReturn := &entity.SalesReturn{
		ReturnNumber:    "RTN-TEST-2",
		OriginalOrderID: order.ID,
		ReturnDate:      time.Now(),
		Status:          enum.ReturnPending,
		Reason:          "สินค้าชำรุดอีกชิ้น",
		RefundAmount:    100,
		RefundMethod:    "CASH",
		RequestedAt:     time.Now(),
		CreatedBy:       1,
	}
	secondItems := []entity.SalesReturnItem{{ProductID: product.ID, Quantity: 1, UnitPrice: 100, Subtotal: 100}}
	require.NoError(t, repo.CreateReturn(secondReturn, secondItems), "ต้องคืนของที่เหลือของออเดอร์เดียวกันได้ ถึงแม้ใบคืนก่อนหน้าจะคืนเงินสำเร็จไปแล้ว")
}

// TestCreateReturn_CumulativeQuantityAcrossReturns_ExceedsOrder_ReturnsError: คืนไปแล้ว 2 จาก 5 ชิ้น
// ถ้าขอคืนอีก 4 ชิ้น (รวมเป็น 6) ต้องถูกปฏิเสธ เพราะเกินจำนวนที่ซื้อจริงสะสมข้ามหลายใบคืน
func TestCreateReturn_CumulativeQuantityAcrossReturns_ExceedsOrder_ReturnsError(t *testing.T) {
	db := setupReturnTestDB(t)
	repo := returnRepo.NewReturnRepository(db)
	firstReturn, order, product := seedCompletedOrderWithReturn(t, db, 200, 2, 5)
	require.NoError(t, repo.ApproveReturn(firstReturn.ID, 1))
	require.NoError(t, repo.ProcessRefund(firstReturn.ID, 1))

	secondReturn := &entity.SalesReturn{
		ReturnNumber:    "RTN-TEST-3",
		OriginalOrderID: order.ID,
		ReturnDate:      time.Now(),
		Status:          enum.ReturnPending,
		Reason:          "ขอคืนเกิน",
		RefundAmount:    400,
		RefundMethod:    "CASH",
		RequestedAt:     time.Now(),
		CreatedBy:       1,
	}
	secondItems := []entity.SalesReturnItem{{ProductID: product.ID, Quantity: 4, UnitPrice: 100, Subtotal: 400}}
	err := repo.CreateReturn(secondReturn, secondItems)
	require.ErrorIs(t, err, returnRepo.ErrReturnQuantityExceedsOrder)
}
