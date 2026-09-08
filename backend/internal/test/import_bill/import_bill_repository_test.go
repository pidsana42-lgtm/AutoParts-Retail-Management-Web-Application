package importbill

import (
	"database/sql/driver"
	"testing"
	"time"

	"backend/internal/app/entity"
	billRepo "backend/internal/app/repository/import_data"

	gosqlite "github.com/glebarez/go-sqlite"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// sqlite ไม่มีฟังก์ชัน GREATEST()/NOW() ของ Postgres ที่ repository ใช้จริงตอน production
// จึงต้อง polyfill ไว้เฉพาะฝั่ง test เพื่อให้ยิง raw SQL เดิมผ่าน sqlite in-memory ได้
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
	_ = gosqlite.RegisterScalarFunction("NOW", 0, func(_ *gosqlite.FunctionContext, _ []driver.Value) (driver.Value, error) {
		return time.Now(), nil
	})
}

// -----------------------------------------------------------------------------
// ทดสอบ ConfirmBillImportTransaction ตรงๆ ผ่าน sqlite in-memory (ไม่ mock repo)
// เพราะ logic การตัดสินใจ auto-approve / รีเซ็ต is_verified อยู่ใน repository เอง
// -----------------------------------------------------------------------------

func setupImportBillTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	err = db.AutoMigrate(
		&entity.Bill{},
		&entity.BillImage{},
		&entity.BillItem{},
		&entity.BillImportJob{},
		&entity.ProductMappingCorrection{},
		&entity.Supplier{},
		&entity.Category{},
		&entity.SubCategory{},
		&entity.SubSubCategory{},
		&entity.Grade{},
		&entity.Zone{},
		&entity.Shelf{},
		&entity.ShelfLevel{},
		&entity.Brand{},
		&entity.Models{},
		&entity.Unit{},
		&entity.Product{},
		&entity.Inventory{},
	)
	require.NoError(t, err)

	return db
}

// seedProductForImport: เตรียมสินค้า 1 ชิ้นที่มีอยู่แล้วในระบบ (มี cost_price เดิม) สำหรับทดสอบ price mismatch
func seedProductForImport(t *testing.T, db *gorm.DB, costPrice float64) (*entity.Product, *entity.Supplier) {
	unit := entity.Unit{Unit_Name: "ชิ้น"}
	require.NoError(t, db.Create(&unit).Error)
	category := entity.Category{Category_Name: "ทั่วไป"}
	require.NoError(t, db.Create(&category).Error)
	grade := entity.Grade{Grade_Name: "A"}
	require.NoError(t, db.Create(&grade).Error)
	zone := entity.Zone{Zone_Name: "Z1"}
	require.NoError(t, db.Create(&zone).Error)
	shelf := entity.Shelf{Shelf_Name: "S1", ZoneID: zone.ID}
	require.NoError(t, db.Create(&shelf).Error)

	supplier := entity.Supplier{
		SupplierName:      "ซัพพลายเออร์ทดสอบ",
		SupplierAddress:   "-",
		ContactLineSale:   "-",
		PhoneNumberSale:   "-",
		EmailSale:         "supplier_test@example.com",
		BankAccountNumber: "-",
		ShortSupplierName: "TEST",
	}
	require.NoError(t, db.Create(&supplier).Error)

	product := entity.Product{
		Product_Name: "สินค้าทดสอบ",
		Cost_price:   costPrice,
		Sale_price:   costPrice * 1.25,
		Is_Active:    true,
		UnitID:       unit.ID,
		CategoryID:   category.ID,
		GradeID:      grade.ID,
		ShelfID:      shelf.ID,
	}
	require.NoError(t, db.Create(&product).Error)

	return &product, &supplier
}

func newTestBill(billNo string, supplierID uint) *entity.Bill {
	return &entity.Bill{
		TotalAmount:   1000,
		BillNo:        billNo,
		DueDate:       time.Now(),
		CreditTerm:    "30 Days",
		TransportBy:   "-",
		SupplierID:    supplierID,
		Subtotal:      1000,
		DiscountTotal: 0,
		ReceiveDate:   time.Now(),
		VatAmount:     0,
		GrandTotal:    1000,
		PaymentStatus: "Completed",
		VerifiedBy:    1,
	}
}

func newTestBillItem(productID uint, pricePerUnit float64) entity.BillItem {
	return entity.BillItem{
		ItemSequence:       1,
		CompanyProductCode: "CODE-1",
		CompanyProductName: "สินค้าทดสอบ",
		OrderQuantity:      2,
		Unit:               "ชิ้น",
		ConversionFactor:   1,
		PricePerUnit:       pricePerUnit,
		DiscountAmount:     0,
		NetAmount:          pricePerUnit * 2,
		ProductID:          productID,
	}
}

func TestConfirmBillImportTransaction_OwnerAutoApprovesPriceChange(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	bill := newTestBill("BILL-OWNER-1", supplier.ID)
	items := []entity.BillItem{newTestBillItem(product.ID, 150)} // ราคาบิลต่างจาก cost_price เดิม (100)

	err := repo.ConfirmBillImportTransaction(bill, items, nil, "Owner")
	require.NoError(t, err)

	require.True(t, bill.IsVerified, "เจ้าของร้านนำเข้าเอง ต้อง auto-approve ทันที")

	var updated entity.Product
	require.NoError(t, db.First(&updated, product.ID).Error)
	require.Equal(t, float64(150), updated.Cost_price, "ราคาทุนต้องถูกอัปเดตทันทีเมื่อเจ้าของร้านเป็นคนนำเข้า")
}

func TestConfirmBillImportTransaction_EmployeePriceMismatchStaysPending(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	bill := newTestBill("BILL-EMP-1", supplier.ID)
	items := []entity.BillItem{newTestBillItem(product.ID, 150)}

	err := repo.ConfirmBillImportTransaction(bill, items, nil, "Employee")
	require.NoError(t, err)

	require.False(t, bill.IsVerified, "พนักงานนำเข้าบิลที่ราคาไม่ตรง ต้องรอเจ้าของอนุมัติ ไม่ auto-approve")

	var updated entity.Product
	require.NoError(t, db.First(&updated, product.ID).Error)
	require.Equal(t, float64(100), updated.Cost_price, "ห้ามอัปเดตราคาทุนจนกว่าเจ้าของจะอนุมัติ")

	var persisted entity.Bill
	require.NoError(t, db.First(&persisted, bill.ID).Error)
	require.False(t, persisted.IsVerified, "ค่าที่บันทึกจริงใน DB ก็ต้องเป็น false เช่นกัน")
}

func TestConfirmBillImportTransaction_EmployeeNoPriceChangeAutoApproves(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	bill := newTestBill("BILL-EMP-2", supplier.ID)
	items := []entity.BillItem{newTestBillItem(product.ID, 100)} // ราคาตรงกับ cost_price เดิม

	err := repo.ConfirmBillImportTransaction(bill, items, nil, "Employee")
	require.NoError(t, err)

	require.True(t, bill.IsVerified, "ไม่มีราคาที่เปลี่ยน ไม่จำเป็นต้องรออนุมัติ")
}

// TestConfirmBillImportTransaction_ResetsStaleVerifiedFlag: กัน regression ของบั๊ก GORM
// Updates(struct) ข้าม zero-value field — ถ้าเลขที่บิลเดิมเคยอนุมัติแล้ว (is_verified=true)
// แล้วมีการนำเข้าซ้ำโดยพนักงานพร้อมราคาที่เปลี่ยนใหม่ ต้อง reset กลับเป็น false เสมอ ไม่ใช่ค้างค่าเดิม
func TestConfirmBillImportTransaction_ResetsStaleVerifiedFlag(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	// รอบแรก: เจ้าของร้านนำเข้าและอนุมัติอัตโนมัติ
	firstBill := newTestBill("BILL-DUP-1", supplier.ID)
	firstItems := []entity.BillItem{newTestBillItem(product.ID, 150)}
	require.NoError(t, repo.ConfirmBillImportTransaction(firstBill, firstItems, nil, "Owner"))
	require.True(t, firstBill.IsVerified)

	// รอบสอง: บิลเลขเดิมถูกนำเข้าซ้ำโดยพนักงาน พร้อมราคาที่เปลี่ยนอีกครั้ง (mismatch ใหม่)
	secondBill := newTestBill("BILL-DUP-1", supplier.ID)
	secondItems := []entity.BillItem{newTestBillItem(product.ID, 200)}
	require.NoError(t, repo.ConfirmBillImportTransaction(secondBill, secondItems, nil, "Employee"))

	require.False(t, secondBill.IsVerified, "ต้อง reset เป็น pending แม้บิลเลขเดิมเคยอนุมัติไปแล้วก่อนหน้า")

	var persisted entity.Bill
	require.NoError(t, db.Where("bill_no = ?", "BILL-DUP-1").First(&persisted).Error)
	require.False(t, persisted.IsVerified, "ค่าที่บันทึกจริงใน DB ต้องไม่ค้างเป็น true จากรอบแรก")
}
