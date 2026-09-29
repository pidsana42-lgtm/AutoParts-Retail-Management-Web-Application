package preorder

import (
	"testing"
	"time"

	"backend/internal/app/entity"
	preOrderRepo "backend/internal/app/repository/pre_oder"

	"github.com/stretchr/testify/require"
)

// TestUpdatePreOrder_DoesNotCascadeSaveStalePreloadedAssociations: regression test สำหรับบั๊กจริงที่รายงานมา —
// แก้ไขพรีออเดอร์แล้วได้ 500 เพราะ GetPreOrderByID() preload Customer/Supplier/PreOrderItems.Product.Inventories.Supplier
// มาเต็มๆ แล้ว UpdatePreOrder() เดิมใช้ FullSaveAssociations:true ทำให้ GORM cascade เขียนทับข้อมูลเก่าที่ preload มา
// กลับเข้าตาราง customers/suppliers ด้วย ทั้งที่ตั้งใจจะแก้แค่ field ของ PreOrder เอง
func TestUpdatePreOrder_DoesNotCascadeSaveStalePreloadedAssociations(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&entity.Supplier{},
		&entity.Product{},
		&entity.Inventory{},
		&entity.PreOrder{},
		&entity.PreOrderItem{},
		&entity.BillItem{},
		&entity.POItems{},
	))
	repo := preOrderRepo.NewPreOrderRepository(db)

	customer := entity.Customer{CustomerName: "ลูกค้าเดิม", PhoneNumber: "0811111111", CreditLimit: 0}
	require.NoError(t, db.Create(&customer).Error)

	supplier := entity.Supplier{
		SupplierName: "ซัพพลายเออร์เดิม", SupplierAddress: "-", ContactLineSale: "-",
		PhoneNumberSale: "-", EmailSale: "supplier_preorder@example.com",
		BankAccountNumber: "-", ShortSupplierName: "SUP",
	}
	require.NoError(t, db.Create(&supplier).Error)

	product := entity.Product{Product_Code: "P-1", Product_Name: "สินค้าทดสอบ", Cost_price: 100, Sale_price: 150}
	require.NoError(t, db.Create(&product).Error)

	preOrder := entity.PreOrder{
		PreOrderType: "WALK_IN",
		CustomerID:   customer.ID,
		SupplierID:   supplier.ID,
		Status:       "PENDING",
		OrderDate:    time.Now(),
		PreOrderItems: []entity.PreOrderItem{
			{ProductID: &product.ID, Quantity: 1, UnitPrice: 100},
		},
	}
	require.NoError(t, db.Create(&preOrder).Error)

	// จำลอง flow จริงของ service: โหลดกลับมาแบบ preload เต็ม แล้วแก้ field บางส่วนก่อนเซฟ
	loaded, err := repo.GetPreOrderByID(preOrder.ID)
	require.NoError(t, err)
	require.NotNil(t, loaded.Customer, "ต้อง preload Customer มาด้วยเหมือน production")
	require.NotNil(t, loaded.Supplier, "ต้อง preload Supplier มาด้วยเหมือน production")

	loaded.Status = "ORDERED"
	loaded.PreOrderItems = []entity.PreOrderItem{
		{PreOrderID: preOrder.ID, ProductID: &product.ID, Quantity: 5, UnitPrice: 100},
	}

	err = repo.UpdatePreOrder(loaded, true)
	require.NoError(t, err, "การแก้ไขพรีออเดอร์ต้องไม่ error แม้ entity ที่ส่งเข้ามาจะมี Customer/Supplier preload เต็มมาด้วย")

	// ต้องอัปเดตเฉพาะ PreOrder เอง — ห้ามแตะข้อมูล Customer/Supplier ที่ preload มาเลย
	var unchangedCustomer entity.Customer
	require.NoError(t, db.First(&unchangedCustomer, customer.ID).Error)
	require.Equal(t, "ลูกค้าเดิม", unchangedCustomer.CustomerName)

	var unchangedSupplier entity.Supplier
	require.NoError(t, db.First(&unchangedSupplier, supplier.ID).Error)
	require.Equal(t, "ซัพพลายเออร์เดิม", unchangedSupplier.SupplierName)

	var updated entity.PreOrder
	require.NoError(t, db.Preload("PreOrderItems").First(&updated, preOrder.ID).Error)
	require.Equal(t, "ORDERED", updated.Status)
	require.Len(t, updated.PreOrderItems, 1)
	require.Equal(t, 5, updated.PreOrderItems[0].Quantity)
}

// TestUpdatePreOrder_StatusOnlyChangeDoesNotLoseItems: regression test สำหรับบั๊กจริงที่รายงานมา —
// กดยกเลิกใบสั่งจอง (เปลี่ยนแค่ status เป็น CANCELLED ไม่ได้แตะ PreOrderItems เลย) แล้วรายการสินค้า
// หายหมดจากหน้าจอ สาเหตุคือ preOrder.PreOrderItems ที่ preload มาใช้ยังมี ID เดิมติดมา ถ้า repo ไปลบ
// แถวเดิมทิ้งก่อนแล้ว Save ซ้ำ (delete-then-recreate) GORM จะพยายาม UPDATE แถวที่เพิ่งลบไปเอง (0 rows
// affected) แทนที่จะ INSERT ใหม่ — ต้องส่ง itemsChanged=false เพื่อข้ามขั้นตอนลบ-สร้างใหม่ทั้งหมด
func TestUpdatePreOrder_StatusOnlyChangeDoesNotLoseItems(t *testing.T) {
	db := setupPreOrderRepoTestDB(t)
	require.NoError(t, db.AutoMigrate(
		&entity.Supplier{},
		&entity.Product{},
		&entity.Inventory{},
		&entity.PreOrder{},
		&entity.PreOrderItem{},
		&entity.BillItem{},
		&entity.POItems{},
	))
	repo := preOrderRepo.NewPreOrderRepository(db)

	product := entity.Product{Product_Code: "P-CANCEL", Product_Name: "สินค้าทดสอบยกเลิก", Cost_price: 100, Sale_price: 150}
	require.NoError(t, db.Create(&product).Error)

	preOrder := entity.PreOrder{
		PreOrderType: "WALK_IN",
		Status:       "PENDING",
		OrderDate:    time.Now(),
		PreOrderItems: []entity.PreOrderItem{
			{ProductID: &product.ID, Quantity: 3, UnitPrice: 100},
			{ProductID: &product.ID, Quantity: 2, UnitPrice: 100},
		},
	}
	require.NoError(t, db.Create(&preOrder).Error)

	// จำลอง flow จริงของ service ตอนกดยกเลิก: โหลดกลับมาแบบ preload เต็ม (มี ID เดิมติดมากับ
	// PreOrderItems) แล้วแก้แค่ status อย่างเดียว ไม่แตะ PreOrderItems เลย
	loaded, err := repo.GetPreOrderByID(preOrder.ID)
	require.NoError(t, err)
	require.Len(t, loaded.PreOrderItems, 2, "ต้อง preload รายการสินค้าเดิมมาด้วยเหมือน production")

	loaded.Status = "CANCELLED"

	err = repo.UpdatePreOrder(loaded, false)
	require.NoError(t, err)

	var updated entity.PreOrder
	require.NoError(t, db.Preload("PreOrderItems").First(&updated, preOrder.ID).Error)
	require.Equal(t, "CANCELLED", updated.Status)
	require.Len(t, updated.PreOrderItems, 2, "รายการสินค้าต้องยังอยู่ครบหลังยกเลิก ห้ามหายไป")
}
