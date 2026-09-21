package wms

import (
	"testing"
	"time"

	wmsDTO "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	wmsService "backend/internal/app/service/wms"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ทดสอบว่าตารางเช็คสต็อก 1 ใบเลือกได้หลายเป้าหมายพร้อมกัน (หลายหมวดหมู่/หลายโซน/หลายสินค้ารายตัว) ในการมอบหมาย
// ครั้งเดียว — จำนวนสินค้าต้อง union กันข้ามเป้าหมาย (ไม่ใช่ต้องตรงทุกจุด) และหักสินค้าที่เอาออกเองได้ ใช้ DB จำลองจริง
// เพราะ logic อยู่ใน s.db ตรงๆ (resolveTargets/toResponse) ไม่ผ่าน repo ที่ mock ได้
func setupMultiTargetTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.Product{},
		&entity.Category{},
		&entity.Zone{},
		&entity.Shelf{},
		&entity.CheckStockSchedule{},
		&entity.CheckStockScheduleTarget{},
		&entity.CheckStockScheduleExcludedProduct{},
	)
	require.NoError(t, err)
	return db
}

func newMultiTargetService(db *gorm.DB) wmsService.CheckStockScheduleService {
	repo := wmsRepo.NewCheckStockScheduleRepository(db)
	return wmsService.NewCheckStockScheduleService(repo, db, &mockNotificationService{})
}

func TestToResponse_CategoryMultiTarget_UnionsProductsAndListsAllNames(t *testing.T) {
	db := setupMultiTargetTestDB(t)
	svc := newMultiTargetService(db)

	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 1}, Category_Name: "Engine Parts"}).Error)
	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 2}, Category_Name: "Brake Parts"}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 1}, Product_Code: "P-1", Product_Name: "A", CategoryID: 1}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 2}, Product_Code: "P-2", Product_Name: "B", CategoryID: 1}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 3}, Product_Code: "P-3", Product_Name: "C", CategoryID: 2}).Error)

	id, err := svc.CreateSchedule(&wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "CATEGORY",
		CategoryIDs:            []uint{1, 2},
	})
	require.NoError(t, err)

	res, err := svc.GetByID(id)
	require.NoError(t, err)
	require.ElementsMatch(t, []uint{1, 2}, res.CategoryIDs)
	require.Equal(t, 3, res.ProductCount, "should union products across both selected categories")
	require.Contains(t, res.TargetName, "หลายหมวดหมู่ (2)")
	require.Contains(t, res.TargetName, "Engine Parts")
	require.Contains(t, res.TargetName, "Brake Parts")
}

func TestToResponse_CategorySingleTarget_KeepsOldSingleFormat(t *testing.T) {
	db := setupMultiTargetTestDB(t)
	svc := newMultiTargetService(db)

	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 1}, Category_Name: "Engine Parts"}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 1}, Product_Code: "P-1", Product_Name: "A", CategoryID: 1}).Error)

	id, err := svc.CreateSchedule(&wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "CATEGORY",
		CategoryIDs:            []uint{1},
	})
	require.NoError(t, err)

	res, err := svc.GetByID(id)
	require.NoError(t, err)
	require.Equal(t, "หมวดหมู่: Engine Parts", res.TargetName, "single target should keep the plain old format, no count prefix")
	require.Equal(t, 1, res.ProductCount)
}

func TestToResponse_ExcludedProducts_ReducesProductCount(t *testing.T) {
	db := setupMultiTargetTestDB(t)
	svc := newMultiTargetService(db)

	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 1}, Category_Name: "Engine Parts"}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 1}, Product_Code: "P-1", Product_Name: "A", CategoryID: 1}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 2}, Product_Code: "P-2", Product_Name: "B", CategoryID: 1}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 3}, Product_Code: "P-3", Product_Name: "C", CategoryID: 1}).Error)

	id, err := svc.CreateSchedule(&wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "CATEGORY",
		CategoryIDs:            []uint{1},
		ExcludedProductIDs:     []uint{2},
	})
	require.NoError(t, err)

	res, err := svc.GetByID(id)
	require.NoError(t, err)
	require.ElementsMatch(t, []uint{2}, res.ExcludedProductIDs)
	require.Equal(t, 2, res.ProductCount, "excluded product should not count toward the total")
}

func TestToResponse_LocationMultiTarget_UnionsAcrossZones(t *testing.T) {
	db := setupMultiTargetTestDB(t)
	svc := newMultiTargetService(db)

	require.NoError(t, db.Create(&entity.Zone{Model: gorm.Model{ID: 1}, Zone_Name: "A"}).Error)
	require.NoError(t, db.Create(&entity.Zone{Model: gorm.Model{ID: 2}, Zone_Name: "B"}).Error)
	require.NoError(t, db.Create(&entity.Shelf{Model: gorm.Model{ID: 1}, Shelf_Name: "S1", ZoneID: 1}).Error)
	require.NoError(t, db.Create(&entity.Shelf{Model: gorm.Model{ID: 2}, Shelf_Name: "S2", ZoneID: 2}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 1}, Product_Code: "P-1", Product_Name: "A", ShelfID: 1}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 2}, Product_Code: "P-2", Product_Name: "B", ShelfID: 2}).Error)

	id, err := svc.CreateSchedule(&wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "LOCATION",
		ZoneIDs:                []uint{1, 2},
	})
	require.NoError(t, err)

	res, err := svc.GetByID(id)
	require.NoError(t, err)
	require.ElementsMatch(t, []uint{1, 2}, res.ZoneIDs)
	require.Equal(t, 2, res.ProductCount)
	require.Contains(t, res.TargetName, "หลายพื้นที่ (2)")
}

func TestUpdate_ReplacesTargetsAndExcludedProductsEntirely(t *testing.T) {
	db := setupMultiTargetTestDB(t)
	svc := newMultiTargetService(db)

	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 1}, Category_Name: "Engine Parts"}).Error)
	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 2}, Category_Name: "Brake Parts"}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 1}, Product_Code: "P-1", Product_Name: "A", CategoryID: 1}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 2}, Product_Code: "P-2", Product_Name: "B", CategoryID: 2}).Error)

	id, err := svc.CreateSchedule(&wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "CATEGORY",
		CategoryIDs:            []uint{1},
	})
	require.NoError(t, err)

	// สั่งงานซ้ำ/แก้ไข ให้เปลี่ยนไปเลือกหมวดหมู่ 2 แทน (ทดสอบว่าเป้าหมายเก่าถูกแทนที่ทั้งชุด ไม่ใช่ merge กัน)
	err = svc.Update(id, &wmsDTO.CheckStockScheduleRequestDTO{
		Scheduled_DateTime:     time.Now().Add(time.Hour),
		Scheduled_End_DateTime: time.Now().Add(2 * time.Hour),
		CheckType:              "CATEGORY",
		CategoryIDs:            []uint{2},
	})
	require.NoError(t, err)

	res, err := svc.GetByID(id)
	require.NoError(t, err)
	require.ElementsMatch(t, []uint{2}, res.CategoryIDs, "old target (category 1) should be gone, not merged with the new one")
	require.Equal(t, 1, res.ProductCount)
}

func TestToResponse_LegacySingleFieldSchedule_StillWorksWithoutTargetsRows(t *testing.T) {
	db := setupMultiTargetTestDB(t)
	svc := newMultiTargetService(db)

	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 1}, Category_Name: "Engine Parts"}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 1}, Product_Code: "P-1", Product_Name: "A", CategoryID: 1}).Error)

	catID := uint(1)
	// ตารางเก่าก่อนรองรับหลายเป้าหมาย: มีแค่ CategoryID เดี่ยว ไม่มีแถวใน Targets เลย
	require.NoError(t, db.Create(&entity.CheckStockSchedule{
		Model:      gorm.Model{ID: 99},
		Status:     "รอดำเนินการ",
		CheckType:  "CATEGORY",
		CategoryID: &catID,
	}).Error)

	res, err := svc.GetByID(99)
	require.NoError(t, err)
	require.Equal(t, []uint{1}, res.CategoryIDs)
	require.Equal(t, "หมวดหมู่: Engine Parts", res.TargetName)
	require.Equal(t, 1, res.ProductCount)
}
