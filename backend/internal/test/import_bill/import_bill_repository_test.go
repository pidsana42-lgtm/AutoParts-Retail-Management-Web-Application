package importbill

import (
	"testing"

	"backend/internal/app/entity"
	repository "backend/internal/app/repository/import_data"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// ทดสอบระดับ repository ตรงๆ (ไม่ผ่าน mock) เพราะบั๊กที่แก้ (บิลซื้อรับสินค้าเข้าเพิ่มโดยไม่ทิ้งร่องรอยใน
// stock_movements เลย ทำให้หายไปจากฟีด "การเคลื่อนไหวของสินค้า") อยู่ใน ConfirmBillImportTransaction เอง
// ซึ่งเทสเดิมของ service มัวแต่ mock repo ทั้งฟังก์ชันนี้ทิ้งไว้ ไม่เคยรัน logic จริงเลย
func setupImportBillRepoTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Silent),
		DisableForeignKeyConstraintWhenMigrating: true,
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.Supplier{},
		&entity.Product{},
		&entity.Inventory{},
		&entity.Bill{},
		&entity.BillImage{},
		&entity.BillItem{},
		&entity.StockMovement{},
		&entity.User{},
		&entity.Models{},
		&entity.ProductMappingCorrection{},
	)
	require.NoError(t, err)
	return db
}

func TestConfirmBillImportTransaction_ExistingProduct_RecordsStockInMovementAndIncreasesQuantity(t *testing.T) {
	db := setupImportBillRepoTestDB(t)
	repo := repository.NewImportBillRepository(db)

	require.NoError(t, db.Create(&entity.Supplier{Model: gorm.Model{ID: 1}, SupplierName: "บริษัท เอ"}).Error)
	require.NoError(t, db.Create(&entity.Product{Model: gorm.Model{ID: 10}, Product_Code: "P-001", Product_Name: "ผ้าเบรก", Quantity: 5}).Error)

	bill := &entity.Bill{BillNo: "BILL-2026-100", SupplierID: 1, VerifiedBy: 7}
	items := []entity.BillItem{
		{ItemSequence: 1, CompanyProductCode: "CP-1", CompanyProductName: "ผ้าเบรก", OrderQuantity: 20, Unit: "ชิ้น", PricePerUnit: 150, ProductID: 10},
	}

	err := repo.ConfirmBillImportTransaction(bill, items, nil, "Owner")
	require.NoError(t, err)

	var prod entity.Product
	require.NoError(t, db.First(&prod, 10).Error)
	if prod.Quantity != 25 {
		t.Errorf("expected quantity 5+20=25, got %d", prod.Quantity)
	}

	var movements []entity.StockMovement
	require.NoError(t, db.Where("bill_id = ?", bill.ID).Find(&movements).Error)
	if len(movements) != 1 {
		t.Fatalf("expected exactly 1 stock movement recorded for the bill, got %d", len(movements))
	}
	m := movements[0]
	if m.Movement_Type != "IN" {
		t.Errorf("expected movement_type IN, got %q", m.Movement_Type)
	}
	if m.Quantity != 20 {
		t.Errorf("expected quantity 20, got %d", m.Quantity)
	}
	if m.ProductID != 10 {
		t.Errorf("expected product id 10, got %d", m.ProductID)
	}
	if m.SupplierID == nil || *m.SupplierID != 1 {
		t.Errorf("expected supplier id 1, got %v", m.SupplierID)
	}
	if m.UserID == nil || *m.UserID != 7 {
		t.Errorf("expected user id (VerifiedBy) 7, got %v", m.UserID)
	}
}

// หมายเหตุ: เส้นทางแก้ไข/re-confirm บิลเดิม (reverseBillStock — ที่ recordBillStockIn ไปเพิ่มการลบ
// stock_movements เก่าไว้ด้วย) ไม่มีเทสระดับ repository นี้ครอบคลุม เพราะ reverseBillStock เรียกใช้ฟังก์ชัน
// GREATEST() ของ Postgres (คืนยอด inventory แบบไม่ต่ำกว่า 0) ซึ่ง sqlite ไม่มีให้ ทำให้รันใต้ DB จำลองแบบนี้ไม่ได้
// เป็นข้อจำกัดเดิมของโค้ดจุดนั้นอยู่แล้ว ไม่เกี่ยวกับการเปลี่ยนแปลงรอบนี้ — ไม่ได้แก้ไขให้เพราะนอกขอบเขตงาน

// สินค้าใหม่ (ยังไม่เคยมีในระบบ) ที่ถูกสร้างจากบิลนี้ ไม่ต้องบันทึกซ้ำเป็น STOCK_IN เพราะมี PRODUCT_ADDED
// ในฟีดที่โชว์จำนวนเริ่มต้นให้อยู่แล้วตอนสร้างแถวสินค้า (ดูคอมเมนต์ตรง recordBillStockIn ที่เรียกใช้)
func TestConfirmBillImportTransaction_NewProduct_DoesNotRecordStockMovement(t *testing.T) {
	db := setupImportBillRepoTestDB(t)
	require.NoError(t, db.AutoMigrate(&entity.Category{}))
	repo := repository.NewImportBillRepository(db)

	require.NoError(t, db.Create(&entity.Supplier{Model: gorm.Model{ID: 1}, SupplierName: "บริษัท เอ"}).Error)
	require.NoError(t, db.Create(&entity.Category{Model: gorm.Model{ID: 1}, Category_Name: "อะไหล่", Category_Short_Name: "ACC"}).Error)

	bill := &entity.Bill{BillNo: "BILL-2026-300", SupplierID: 1, VerifiedBy: 7}
	items := []entity.BillItem{
		{ItemSequence: 1, CompanyProductCode: "CP-NEW", CompanyProductName: "สินค้าใหม่", OrderQuantity: 15, Unit: "ชิ้น", PricePerUnit: 99},
	}

	err := repo.ConfirmBillImportTransaction(bill, items, nil, "Owner")
	require.NoError(t, err)

	var movements []entity.StockMovement
	require.NoError(t, db.Where("bill_id = ?", bill.ID).Find(&movements).Error)
	if len(movements) != 0 {
		t.Errorf("expected no stock movement for a brand-new product (covered by PRODUCT_ADDED feed event instead), got %d", len(movements))
	}
}
