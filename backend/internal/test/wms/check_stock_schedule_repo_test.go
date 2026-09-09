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
