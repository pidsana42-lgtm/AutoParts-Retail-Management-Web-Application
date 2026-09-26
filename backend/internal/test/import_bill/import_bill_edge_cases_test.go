package importbill

import (
	"testing"

	"backend/internal/app/entity"
	billRepo "backend/internal/app/repository/import_data"

	"github.com/stretchr/testify/require"
)

// เคสขอบของเส้นทางยืนยันนำเข้าบิล — ครอบคลุมสถานการณ์ที่ผู้ใช้จริงทำได้และเคยทำให้ข้อมูลเพี้ยน
//   A. รหัสของซัพพลายเออร์บังเอิญตรงกับรหัสภายในร้านของสินค้าคนละตัว (เคยผูกผิดตัวมาแล้ว)
//   B. กดยืนยันบิลเลขเดิมซ้ำ สต็อกต้องไม่บวกซ้ำ
//   C. จำนวนติดลบต้องถูกปฏิเสธ ไม่ใช่ปล่อยให้สต็อกติดลบ
//   D. สินค้าตัวเดียวกันสองบรรทัดในบิลเดียว ต้องรวมยอดครบทั้งสต็อกรวมและล็อตของซัพ
//   E. บรรทัดที่ไม่มีชื่อสินค้า ต้องไม่ถูกยุบรวมเป็นตัวเดียวกัน

// ── A. รหัสของซัพพลายเออร์ไปชนกับรหัสภายในร้านของสินค้าคนละตัว ──────────────
func TestImportEdge_SupplierCodeCollidesWithInternalCode(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	existing, supplier := seedProductForImport(t, db, 100)

	// สินค้าอีกตัวที่ "รหัสภายในร้าน" บังเอิญตรงกับรหัสที่ซัพพลายเออร์ใช้เรียกของอีกชิ้น
	other := entity.Product{
		Product_Name: "สินค้าคนละตัวกันเลย",
		Product_Code: "SUP-XYZ-01", // รหัสภายในร้าน
		Cost_price:   999,
		Is_Active:    true,
		UnitID:       existing.UnitID, CategoryID: existing.CategoryID,
		GradeID: existing.GradeID, ShelfID: existing.ShelfID,
	}
	require.NoError(t, db.Create(&other).Error)

	bill := newTestBill("BUG-A-001", supplier.ID)
	items := []entity.BillItem{{
		ItemSequence:       1,
		CompanyProductName: "ของใหม่ที่ร้านยังไม่มี",
		CompanyProductCode: "SUP-XYZ-01", // รหัสของซัพ บังเอิญตรงกับรหัสภายในของ other
		OrderQuantity:      5,
		Unit:               "ชิ้น", ConversionFactor: 1, PricePerUnit: 50, NetAmount: 250,
	}}
	require.NoError(t, repo.ConfirmBillImportTransaction(bill, items, nil, "Owner"))

	var saved entity.BillItem
	require.NoError(t, db.Where("bill_id = ?", bill.ID).First(&saved).Error)
	var linked entity.Product
	require.NoError(t, db.First(&linked, saved.ProductID).Error)

	t.Logf("บิลบอกว่า %q -> ผูกกับสินค้า id=%d %q", items[0].CompanyProductName, linked.ID, linked.Product_Name)
	require.NotEqualf(t, other.ID, linked.ID,
		"รหัสซัพพลายเออร์ไปชนรหัสภายในร้าน ทำให้ผูกกับสินค้าผิดตัว (%q)", other.Product_Name)
}

// ── B. ยืนยันบิลใบเดิมซ้ำ สต็อกต้องไม่บวกซ้ำ ─────────────────────────────────
func TestImportEdge_ConfirmSameBillTwiceDoesNotDoubleStock(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)

	mk := func() (*entity.Bill, []entity.BillItem) {
		return newTestBill("BUG-B-001", supplier.ID), []entity.BillItem{{
			ItemSequence: 1, ProductID: product.ID,
			CompanyProductName: product.Product_Name, CompanyProductCode: "SUP-1",
			OrderQuantity: 10, Unit: "ชิ้น", ConversionFactor: 1, PricePerUnit: 100, NetAmount: 1000,
		}}
	}
	b1, i1 := mk()
	require.NoError(t, repo.ConfirmBillImportTransaction(b1, i1, nil, "Owner"))
	var after1 entity.Product
	require.NoError(t, db.First(&after1, product.ID).Error)

	b2, i2 := mk()
	require.NoError(t, repo.ConfirmBillImportTransaction(b2, i2, nil, "Owner"))
	var after2 entity.Product
	require.NoError(t, db.First(&after2, product.ID).Error)

	t.Logf("สต็อกหลังยืนยันครั้งแรก=%d ครั้งที่สอง=%d", after1.Quantity, after2.Quantity)
	require.Equalf(t, after1.Quantity, after2.Quantity,
		"ยืนยันบิลเลขเดิมซ้ำแล้วสต็อกบวกเพิ่ม (%d -> %d)", after1.Quantity, after2.Quantity)
}

// ── C. จำนวนติดลบ ต้องไม่ทำให้สต็อกติดลบเงียบ ๆ ─────────────────────────────
func TestImportEdge_NegativeQuantityRejected(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)
	require.NoError(t, db.Model(product).Update("quantity", 3).Error)

	bill := newTestBill("BUG-C-001", supplier.ID)
	items := []entity.BillItem{{
		ItemSequence: 1, ProductID: product.ID,
		CompanyProductName: product.Product_Name, CompanyProductCode: "SUP-1",
		OrderQuantity: -50, Unit: "ชิ้น", ConversionFactor: 1, PricePerUnit: 100, NetAmount: -5000,
	}}
	err := repo.ConfirmBillImportTransaction(bill, items, nil, "Owner")

	var after entity.Product
	require.NoError(t, db.First(&after, product.ID).Error)
	t.Logf("err=%v  สต็อกหลังนำเข้าจำนวน -50 = %d", err, after.Quantity)
	require.GreaterOrEqualf(t, after.Quantity, 0,
		"นำเข้าด้วยจำนวนติดลบแล้วสต็อกติดลบ (%d)", after.Quantity)
}

// ── D. สินค้าตัวเดียวกันปรากฏสองบรรทัดในบิลเดียว ต้องรวมเข้าสต็อกครบ ────────
func TestImportEdge_DuplicateLineItemsAccumulate(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	product, supplier := seedProductForImport(t, db, 100)
	require.NoError(t, db.Model(product).Update("quantity", 0).Error)

	bill := newTestBill("BUG-D-001", supplier.ID)
	line := entity.BillItem{
		ProductID: product.ID, CompanyProductName: product.Product_Name, CompanyProductCode: "SUP-1",
		OrderQuantity: 4, Unit: "ชิ้น", ConversionFactor: 1, PricePerUnit: 100, NetAmount: 400,
	}
	a, b := line, line
	a.ItemSequence, b.ItemSequence = 1, 2
	require.NoError(t, repo.ConfirmBillImportTransaction(bill, []entity.BillItem{a, b}, nil, "Owner"))

	var after entity.Product
	require.NoError(t, db.First(&after, product.ID).Error)
	var inv entity.Inventory
	require.NoError(t, db.Where("product_id = ? AND supplier_id = ?", product.ID, supplier.ID).First(&inv).Error)
	t.Logf("สั่ง 4+4=8 ชิ้น -> สต็อกสินค้า=%d  ล็อตของซัพ=%d", after.Quantity, inv.Inventory_Quantity)
	require.Equal(t, 8, after.Quantity, "สองบรรทัดของสินค้าเดียวกันรวมเข้าสต็อกไม่ครบ")
	require.Equal(t, 8, inv.Inventory_Quantity, "ยอดในล็อตของซัพพลายเออร์ไม่ตรงกับสต็อกรวม")
}

// ── E. ชื่อสินค้าว่าง ต้องไม่สร้างสินค้าขยะทับกัน ────────────────────────────
func TestImportEdge_EmptyProductNameDoesNotCollide(t *testing.T) {
	db := setupImportBillTestDB(t)
	repo := billRepo.NewImportBillRepository(db)
	_, supplier := seedProductForImport(t, db, 100)

	bill := newTestBill("BUG-E-001", supplier.ID)
	items := []entity.BillItem{
		{ItemSequence: 1, CompanyProductName: "   ", CompanyProductCode: "", OrderQuantity: 2, Unit: "ชิ้น", ConversionFactor: 1, PricePerUnit: 10, NetAmount: 20},
		{ItemSequence: 2, CompanyProductName: "", CompanyProductCode: "", OrderQuantity: 3, Unit: "ชิ้น", ConversionFactor: 1, PricePerUnit: 10, NetAmount: 30},
	}
	require.NoError(t, repo.ConfirmBillImportTransaction(bill, items, nil, "Owner"))

	var saved []entity.BillItem
	require.NoError(t, db.Where("bill_id = ?", bill.ID).Order("item_sequence").Find(&saved).Error)
	require.Len(t, saved, 2)
	t.Logf("บรรทัด 1 -> product %d, บรรทัด 2 -> product %d", saved[0].ProductID, saved[1].ProductID)
	require.NotEqual(t, saved[0].ProductID, saved[1].ProductID,
		"สองบรรทัดที่ไม่มีชื่อถูกยุบเป็นสินค้าตัวเดียวกัน จำนวนจะรวมผิด")
}

// ── F. การปรับราคาทุนเป็นอำนาจของเจ้าของร้านคนเดียว ──────────────────────────
//
// ผู้จัดการนำเข้าบิลได้ตามปกติ แต่ถ้าบิลมีรายการที่ราคาทุนต่างจากในระบบ รายการนั้นต้องถูก
// กันไว้รอเจ้าของอนุมัติ ไม่นับเข้าสต็อกทันที (PendingReceiveQuantity) และบิลต้องยังไม่ verified
// เดิม repository นับผู้จัดการเป็นผู้มีสิทธิ์ จึงขัดกับ bill_controller ที่ห้ามผู้จัดการกดอนุมัติ
func TestImportEdge_PriceChangeApprovalIsOwnerOnly(t *testing.T) {
	for _, tc := range []struct {
		role           string
		wantVerified   bool
		wantPendingQty int
		wantStockAdded int
	}{
		{"Owner", true, 0, 10},
		{"Manager", false, 10, 0},
		{"Employee", false, 10, 0},
	} {
		t.Run(tc.role, func(t *testing.T) {
			db := setupImportBillTestDB(t)
			repo := billRepo.NewImportBillRepository(db)
			product, supplier := seedProductForImport(t, db, 100) // ราคาทุนเดิม 100
			require.NoError(t, db.Model(product).Update("quantity", 0).Error)

			bill := newTestBill("BUG-F-"+tc.role, supplier.ID)
			items := []entity.BillItem{{
				ItemSequence: 1, ProductID: product.ID,
				CompanyProductName: product.Product_Name, CompanyProductCode: "SUP-1",
				OrderQuantity: 10, Unit: "ชิ้น", ConversionFactor: 1,
				PricePerUnit: 250, NetAmount: 2500, // ราคาทุนเปลี่ยนจาก 100 -> 250
			}}
			require.NoError(t, repo.ConfirmBillImportTransaction(bill, items, nil, tc.role))

			var savedBill entity.Bill
			require.NoError(t, db.First(&savedBill, bill.ID).Error)
			require.Equalf(t, tc.wantVerified, savedBill.IsVerified,
				"%s: สถานะอนุมัติบิลไม่ตรงกับที่ควรเป็น", tc.role)

			var savedItem entity.BillItem
			require.NoError(t, db.Where("bill_id = ?", bill.ID).First(&savedItem).Error)
			require.Equalf(t, tc.wantPendingQty, savedItem.PendingReceiveQuantity,
				"%s: จำนวนที่กันไว้รออนุมัติไม่ตรง", tc.role)

			var after entity.Product
			require.NoError(t, db.First(&after, product.ID).Error)
			require.Equalf(t, tc.wantStockAdded, after.Quantity,
				"%s: จำนวนที่เข้าสต็อกจริงไม่ตรง", tc.role)
		})
	}
}

// บิลที่ราคาทุนไม่เปลี่ยน ใครนำเข้าก็ผ่านได้ทันที ไม่ต้องรอเจ้าของ
func TestImportEdge_NoPriceChangeAutoApprovesForAnyRole(t *testing.T) {
	for _, role := range []string{"Owner", "Manager", "Employee"} {
		t.Run(role, func(t *testing.T) {
			db := setupImportBillTestDB(t)
			repo := billRepo.NewImportBillRepository(db)
			product, supplier := seedProductForImport(t, db, 100)
			require.NoError(t, db.Model(product).Update("quantity", 0).Error)

			bill := newTestBill("BUG-G-"+role, supplier.ID)
			items := []entity.BillItem{{
				ItemSequence: 1, ProductID: product.ID,
				CompanyProductName: product.Product_Name, CompanyProductCode: "SUP-1",
				OrderQuantity: 7, Unit: "ชิ้น", ConversionFactor: 1,
				PricePerUnit: 100, NetAmount: 700, // ราคาทุนเท่าเดิม
			}}
			require.NoError(t, repo.ConfirmBillImportTransaction(bill, items, nil, role))

			var savedBill entity.Bill
			require.NoError(t, db.First(&savedBill, bill.ID).Error)
			require.Truef(t, savedBill.IsVerified, "%s: บิลที่ราคาไม่เปลี่ยนควรผ่านทันที", role)

			var after entity.Product
			require.NoError(t, db.First(&after, product.ID).Error)
			require.Equalf(t, 7, after.Quantity, "%s: ของต้องเข้าสต็อกครบ", role)
		})
	}
}
