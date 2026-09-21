package wms

import (
	"strings"
	"testing"
	"time"

	"backend/internal/app/entity"
	wmsService "backend/internal/app/service/wms"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ทดสอบ ApproveSchedule ด้วย DB จำลองจริง (ไม่ใช่ mock ล้วน) เพราะ logic ที่แก้ (เขียนแถว stock_movements
// movement_type=ADJUST ให้ฟีด "การเคลื่อนไหวของสินค้า" อ่านได้โดยตรง) อยู่ใน s.db ตรงๆ ไม่ผ่าน repo ที่ mock ได้
func setupCheckStockScheduleRepoTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.Product{},
		&entity.CheckStock{},
		&entity.CheckStockSchedule{},
		&entity.StockMovement{},
		&entity.Inventory{},
	)
	require.NoError(t, err)
	return db
}

func TestApproveSchedule_WritesAdjustMovementOnlyForRowsThatActuallyDiffer(t *testing.T) {
	db := setupCheckStockScheduleRepoTestDB(t)

	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 5}, Product_Code: "P-5", Product_Name: "Turbo", Quantity: 20}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 6}, Product_Code: "P-6", Product_Name: "Filter", Quantity: 8}).Error)

	scheduleID := uint(1)
	counterID := uint(9)
	require.NoError(t, db.Create(&entity.CheckStockSchedule{
		Model:  gorm.Model{ID: scheduleID},
		Status: "รอตรวจสอบ",
	}).Error)

	// แถวนับได้เกิน (diff != 0) -> ต้องมีแถว stock_movements ใหม่
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity:         10,
		New_Quantity:         15,
		Diff_Quantity:        5,
		Reason:               "นับใหม่เจอเพิ่ม",
		Adjustment_DateTime:  time.Date(2026, 3, 1, 9, 0, 0, 0, time.UTC),
		ProductID:            &[]uint{5}[0],
		UserID:               &counterID,
		CheckStockScheduleID: &scheduleID,
	}).Error)

	// แถวนับตรงเป๊ะ (diff == 0) -> ไม่ควรมีแถว stock_movements ใหม่
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity:         8,
		New_Quantity:         8,
		Diff_Quantity:        0,
		Adjustment_DateTime:  time.Date(2026, 3, 1, 9, 5, 0, 0, time.UTC),
		ProductID:            &[]uint{6}[0],
		UserID:               &counterID,
		CheckStockScheduleID: &scheduleID,
	}).Error)

	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}, nil
	}

	svc := wmsService.NewCheckStockScheduleService(repo, db, nil)
	require.NoError(t, svc.ApproveSchedule(scheduleID))

	var product5, product6 entity.Product
	require.NoError(t, db.First(&product5, 5).Error)
	require.NoError(t, db.First(&product6, 6).Error)
	if product5.Quantity != 15 {
		t.Errorf("expected product 5 quantity updated to 15, got %d", product5.Quantity)
	}
	if product6.Quantity != 8 {
		t.Errorf("expected product 6 quantity unchanged at 8, got %d", product6.Quantity)
	}

	var movements []entity.StockMovement
	require.NoError(t, db.Where("movement_type = ?", "ADJUST").Find(&movements).Error)
	if len(movements) != 1 {
		t.Fatalf("expected exactly 1 ADJUST movement (only the row that actually differed), got %d", len(movements))
	}
	m := movements[0]
	if m.ProductID != 5 {
		t.Errorf("expected movement for product 5, got %d", m.ProductID)
	}
	if m.Quantity != 5 {
		t.Errorf("expected movement quantity to carry the signed diff (5), got %d", m.Quantity)
	}
	if m.UserID == nil || *m.UserID != counterID {
		t.Errorf("expected movement user id to be the counter (%d), got %v", counterID, m.UserID)
	}
	if !strings.Contains(m.Note, "เดิม 10 → นับได้ 15") || !strings.Contains(m.Note, "เกิน 5") {
		t.Errorf("expected note to describe old->new and excess sign, got %q", m.Note)
	}
	if !strings.Contains(m.Note, "นับใหม่เจอเพิ่ม") {
		t.Errorf("expected note to include the counter's reason, got %q", m.Note)
	}
}

func TestApproveSchedule_ShortageDiff_NoteUsesShortageWording(t *testing.T) {
	db := setupCheckStockScheduleRepoTestDB(t)

	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 5}, Product_Code: "P-5", Product_Name: "Turbo", Quantity: 20}).Error)

	scheduleID := uint(1)
	require.NoError(t, db.Create(&entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}).Error)
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity:         20,
		New_Quantity:         17,
		Diff_Quantity:        -3,
		Adjustment_DateTime:  time.Now(),
		ProductID:            &[]uint{5}[0],
		CheckStockScheduleID: &scheduleID,
	}).Error)

	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}, nil
	}

	svc := wmsService.NewCheckStockScheduleService(repo, db, nil)
	require.NoError(t, svc.ApproveSchedule(scheduleID))

	var movements []entity.StockMovement
	require.NoError(t, db.Where("movement_type = ?", "ADJUST").Find(&movements).Error)
	if len(movements) != 1 {
		t.Fatalf("expected exactly 1 ADJUST movement, got %d", len(movements))
	}
	if !strings.Contains(movements[0].Note, "ขาด 3") {
		t.Errorf("expected note to describe a shortage of 3, got %q", movements[0].Note)
	}
	if movements[0].Quantity != -3 {
		t.Errorf("expected movement quantity to carry the signed diff (-3), got %d", movements[0].Quantity)
	}
}

// สินค้าที่มีหลายบริษัท พนักงานนับแยกเป็นคนละแถว (คนละ record ต่อบริษัท) — แต่ละแถวต้องไปปรับ Inventory ของบริษัท
// นั้นตรงๆ และ Product.Quantity ต้องเป็นผลรวมของทุกแถว ไม่ใช่แค่ค่าของแถวสุดท้ายทับแถวก่อน
func TestApproveSchedule_MultipleSupplierRecordsPerProduct_UpdatesEachInventoryAndSumsProductTotal(t *testing.T) {
	db := setupCheckStockScheduleRepoTestDB(t)

	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 7}, Product_Code: "P-7", Product_Name: "Brake Pad", Quantity: 10}).Error)
	require.NoError(t, db.Create(&entity.Inventory{Model: gorm.Model{ID: 1}, ProductID: 7, SupplierID: 1, Inventory_Quantity: 5}).Error)
	require.NoError(t, db.Create(&entity.Inventory{Model: gorm.Model{ID: 2}, ProductID: 7, SupplierID: 2, Inventory_Quantity: 5}).Error)

	scheduleID := uint(1)
	require.NoError(t, db.Create(&entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}).Error)

	productID := uint(7)
	supplier1, supplier2 := uint(1), uint(2)
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity: 5, New_Quantity: 6, Diff_Quantity: 1,
		Adjustment_DateTime: time.Now(), ProductID: &productID, SupplierID: &supplier1, CheckStockScheduleID: &scheduleID,
	}).Error)
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity: 5, New_Quantity: 4, Diff_Quantity: -1,
		Adjustment_DateTime: time.Now(), ProductID: &productID, SupplierID: &supplier2, CheckStockScheduleID: &scheduleID,
	}).Error)

	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}, nil
	}

	svc := wmsService.NewCheckStockScheduleService(repo, db, nil)
	require.NoError(t, svc.ApproveSchedule(scheduleID))

	var inv1, inv2 entity.Inventory
	require.NoError(t, db.First(&inv1, 1).Error)
	require.NoError(t, db.First(&inv2, 2).Error)
	if inv1.Inventory_Quantity != 6 {
		t.Errorf("expected supplier 1's inventory updated to 6, got %d", inv1.Inventory_Quantity)
	}
	if inv2.Inventory_Quantity != 4 {
		t.Errorf("expected supplier 2's inventory updated to 4, got %d", inv2.Inventory_Quantity)
	}

	var product entity.Product
	require.NoError(t, db.First(&product, 7).Error)
	if product.Quantity != 10 {
		t.Errorf("expected product total to be the sum of both supplier rows (6+4=10), got %d", product.Quantity)
	}

	var movements []entity.StockMovement
	require.NoError(t, db.Where("product_id = ? AND movement_type = ?", 7, "ADJUST").Find(&movements).Error)
	if len(movements) != 2 {
		t.Fatalf("expected one ADJUST movement per supplier row that differed, got %d", len(movements))
	}
}

// แถวที่ไม่ระบุบริษัท (SupplierID เป็น nil เช่นส่วนต่างที่หาที่มาไม่ได้) ต้องไม่ไปแตะ Inventory ของใครเลย
// แต่ยังต้องถูกรวมเข้ายอด Product.Quantity เหมือนแถวอื่น
func TestApproveSchedule_RecordWithoutSupplier_SkipsInventoryButCountsTowardProductTotal(t *testing.T) {
	db := setupCheckStockScheduleRepoTestDB(t)

	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 7}, Product_Code: "P-7", Product_Name: "Brake Pad", Quantity: 10}).Error)
	require.NoError(t, db.Create(&entity.Inventory{Model: gorm.Model{ID: 1}, ProductID: 7, SupplierID: 1, Inventory_Quantity: 5}).Error)

	scheduleID := uint(1)
	require.NoError(t, db.Create(&entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}).Error)

	productID := uint(7)
	supplier1 := uint(1)
	// แถวของบริษัทที่รู้จัก
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity: 5, New_Quantity: 5, Diff_Quantity: 0,
		Adjustment_DateTime: time.Now(), ProductID: &productID, SupplierID: &supplier1, CheckStockScheduleID: &scheduleID,
	}).Error)
	// แถว "ไม่ทราบบริษัท / อื่นๆ" (ส่วนต่างเดิมที่ยอดรวม 10 ไม่ตรงกับผลบวกบริษัท 5) — ไม่มี SupplierID
	require.NoError(t, db.Create(&entity.CheckStock{
		Old_Quantity: 5, New_Quantity: 3, Diff_Quantity: -2,
		Adjustment_DateTime: time.Now(), ProductID: &productID, CheckStockScheduleID: &scheduleID,
	}).Error)

	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}, nil
	}

	svc := wmsService.NewCheckStockScheduleService(repo, db, nil)
	require.NoError(t, svc.ApproveSchedule(scheduleID))

	var inv1 entity.Inventory
	require.NoError(t, db.First(&inv1, 1).Error)
	if inv1.Inventory_Quantity != 5 {
		t.Errorf("expected supplier 1's inventory left untouched at 5, got %d", inv1.Inventory_Quantity)
	}

	var product entity.Product
	require.NoError(t, db.First(&product, 7).Error)
	if product.Quantity != 8 {
		t.Errorf("expected product total to be the sum of both rows (5+3=8), got %d", product.Quantity)
	}
}

// กรณีพนักงานกดยื่นซ้ำ หรือมีการ retry ยิง record ซ้ำซ้อนลงตารางเดียวกัน
// ApproveSchedule ต้องคัดเฉพาะ record ล่าสุดของแต่ละคู่ (ProductID, SupplierID) เท่านั้น
// ไม่เอาทุกแถวมาบวกสะสม (+=) จนสต็อกพุ่งเกินจริง
func TestApproveSchedule_DuplicateRecordsDeduplicated(t *testing.T) {
	db := setupCheckStockScheduleRepoTestDB(t)

	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 16}, Product_Code: "P-16", Product_Name: "Oil 5L", Quantity: 30}).Error)
	require.NoError(t, db.Create(&entity.Inventory{Model: gorm.Model{ID: 5}, ProductID: 16, SupplierID: 3, Inventory_Quantity: 30}).Error)

	scheduleID := uint(2)
	require.NoError(t, db.Create(&entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}).Error)

	productID := uint(16)
	supplierID := uint(3)

	// แถวที่ 1 (ครั้งแรก - สมมตินับได้ 30)
	require.NoError(t, db.Create(&entity.CheckStock{
		Model: gorm.Model{ID: 1}, Old_Quantity: 30, New_Quantity: 30, Diff_Quantity: 0,
		Adjustment_DateTime: time.Now(), ProductID: &productID, SupplierID: &supplierID, CheckStockScheduleID: &scheduleID,
	}).Error)

	// แถวที่ 2 (กดยื่นซ้ำ/retry - ID สูงกว่า นับได้ 40)
	require.NoError(t, db.Create(&entity.CheckStock{
		Model: gorm.Model{ID: 2}, Old_Quantity: 30, New_Quantity: 40, Diff_Quantity: 10,
		Adjustment_DateTime: time.Now(), ProductID: &productID, SupplierID: &supplierID, CheckStockScheduleID: &scheduleID,
	}).Error)

	repo := newMockCheckStockScheduleRepo()
	repo.getByIDFn = func(id uint) (*entity.CheckStockSchedule, error) {
		return &entity.CheckStockSchedule{Model: gorm.Model{ID: scheduleID}, Status: "รอตรวจสอบ"}, nil
	}

	svc := wmsService.NewCheckStockScheduleService(repo, db, nil)
	require.NoError(t, svc.ApproveSchedule(scheduleID))

	var inv entity.Inventory
	require.NoError(t, db.First(&inv, 5).Error)
	if inv.Inventory_Quantity != 40 {
		t.Errorf("expected inventory quantity 40, got %d", inv.Inventory_Quantity)
	}

	var product entity.Product
	require.NoError(t, db.First(&product, 16).Error)
	if product.Quantity != 40 {
		t.Errorf("expected product quantity 40 (deduplicated), got %d (might have added duplicates)", product.Quantity)
	}

	// stock_movements ควรมีเพียง 1 รายการ (ของ record ล่าสุดที่ diff != 0)
	var movements []entity.StockMovement
	require.NoError(t, db.Where("product_id = ? AND movement_type = ?", 16, "ADJUST").Find(&movements).Error)
	if len(movements) != 1 {
		t.Errorf("expected exactly 1 movement record, got %d", len(movements))
	}
}

