package importbill

import (
	dto "backend/internal/app/dto/pre_oder"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	billRepo "backend/internal/app/repository/import_data"
	posRepo "backend/internal/app/repository/pos"
	preRepo "backend/internal/app/repository/pre_oder"
	posSvc "backend/internal/app/service/pos"
	receiving "backend/internal/app/service/preorder_receiving"
	"backend/internal/pkg/preorderstock"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"testing"
)

type receiptFixture struct {
	db                     *gorm.DB
	product                *entity.Product
	supplier               *entity.Supplier
	pre                    entity.PreOrder
	po                     entity.PO
	customerLine, shopLine entity.POItems
}

func receiptSetup(t *testing.T) receiptFixture {
	db := setupImportBillTestDB(t)
	require.NoError(t, db.AutoMigrate(&entity.PreOrder{}, &entity.PreOrderItem{}, &entity.POItems{}))
	product, supplier := seedProductForImport(t, db, 100)
	pre := entity.PreOrder{PreOrderType: "WALK_IN", CustomerID: 1, SupplierID: supplier.ID, Status: "PENDING", PreOrderItems: []entity.PreOrderItem{{ProductID: &product.ID, Quantity: 4, UnitPrice: 100, Status: "RESERVED"}}}
	require.NoError(t, db.Create(&pre).Error)
	po := entity.PO{PO_number: "PO-TEST", Status: enum.POStatus("APPROVED"), SupplierID: supplier.ID}
	require.NoError(t, db.Create(&po).Error)
	customer := entity.POItems{POID: po.ID, ProductID: &product.ID, PreOrderItemID: &pre.PreOrderItems[0].ID, Quantity: 4, Unit: "ชิ้น"}
	shop := entity.POItems{POID: po.ID, ProductID: &product.ID, Quantity: 10, Unit: "ชิ้น"}
	require.NoError(t, db.Create(&customer).Error)
	require.NoError(t, db.Create(&shop).Error)
	return receiptFixture{db, product, supplier, pre, po, customer, shop}
}
func (f receiptFixture) line(source entity.POItems, qty int) entity.BillItem {
	item := newTestBillItem(f.product.ID, 100)
	item.POItemID = &source.ID
	item.PreOrderItemID = source.PreOrderItemID
	item.OrderQuantity = qty
	return item
}
func (f receiptFixture) receive(t *testing.T, name string, lines ...entity.BillItem) *entity.Bill {
	bill := newTestBill(name, f.supplier.ID)
	bill.POID = &f.po.ID
	require.NoError(t, billRepo.NewImportBillRepository(f.db).ConfirmBillImportTransaction(bill, lines, nil, "Owner"))
	return bill
}
func (f receiptFixture) status(t *testing.T) string {
	orders := []entity.PreOrder{f.pre}
	require.NoError(t, preorderstock.Populate(f.db, orders))
	return dto.ToPreOrderResponseDTO(&orders[0]).Status
}
func (f receiptFixture) assertStock(t *testing.T, physical, reserved int) {
	var p entity.Product
	require.NoError(t, f.db.First(&p, f.product.ID).Error)
	require.Equal(t, physical, p.Quantity)
	r, err := preorderstock.Reserved(f.db, p.ID, nil)
	require.NoError(t, err)
	require.Equal(t, reserved, r)
	products, err := receiving.WithAvailableStock(f.db, posSvc.NewPOSProductService(posRepo.NewPOSProductRepository(f.db))).SearchPOSProducts("")
	require.NoError(t, err)
	require.Len(t, products, 1)
	require.Equal(t, physical-reserved, products[0].Quantity)
	var po entity.PO
	require.NoError(t, f.db.First(&po, f.po.ID).Error)
	require.Equal(t, f.po.Status, po.Status)
	require.True(t, f.po.UpdatedAt.Equal(po.UpdatedAt), "receipt must not update PO")
}
func TestReceipt_MixedPOAndPartialPreorder(t *testing.T) {
	f := receiptSetup(t)
	f.receive(t, "R1", f.line(f.shopLine, 5))
	f.assertStock(t, 5, 0)
	require.Equal(t, "PENDING", f.status(t))
	first := f.receive(t, "R2", f.line(f.customerLine, 2))
	f.assertStock(t, 7, 2)
	require.Equal(t, "PARTIALLY_RECEIVED", f.status(t))
	// Reconfirming the same bill must not double count stock or reservations.
	f.receive(t, "R2", f.line(f.customerLine, 2))
	f.assertStock(t, 7, 2)
	f.receive(t, "R3", f.line(f.customerLine, 2))
	f.assertStock(t, 9, 4)
	require.Equal(t, "READY", f.status(t))
	// Deleting one partial receipt releases only its own quantity.
	require.NoError(t, billRepo.NewImportBillRepository(f.db).DeleteBill(first.ID))
	f.assertStock(t, 7, 2)
	require.Equal(t, "PARTIALLY_RECEIVED", f.status(t))
}
func TestReceipt_DraftAndEdit(t *testing.T) {
	f := receiptSetup(t)
	repo := billRepo.NewImportBillRepository(f.db)
	bill := newTestBill("DRAFT", f.supplier.ID)
	bill.POID = &f.po.ID
	bill.PaymentStatus = "Draft"
	require.NoError(t, repo.ConfirmBillImportTransaction(bill, []entity.BillItem{f.line(f.customerLine, 4)}, nil, "Owner"))
	f.assertStock(t, 0, 0)
	require.Equal(t, "PENDING", f.status(t))
	bill.PaymentStatus = "unpaid"
	require.NoError(t, repo.UpdateBill(bill.ID, bill, []entity.BillItem{f.line(f.customerLine, 4)}))
	f.assertStock(t, 4, 4)
	require.NoError(t, repo.UpdateBill(bill.ID, bill, []entity.BillItem{f.line(f.customerLine, 1)}))
	f.assertStock(t, 1, 1)
	require.Equal(t, "PARTIALLY_RECEIVED", f.status(t))
}
func TestReceipt_InvalidLinksAndOverReceiptRollback(t *testing.T) {
	for _, test := range []string{"wrong_po", "wrong_preorder", "missing_line", "excess", "supplier"} {
		t.Run(test, func(t *testing.T) {
			f := receiptSetup(t)
			bill := newTestBill("BAD", f.supplier.ID)
			bill.POID = &f.po.ID
			item := f.line(f.customerLine, 2)
			bad := uint(999)
			switch test {
			case "wrong_po":
				bill.POID = &bad
			case "wrong_preorder":
				item.PreOrderItemID = &bad
			case "missing_line":
				item.POItemID = nil
			case "excess":
				item.OrderQuantity = 5
			case "supplier":
				bill.SupplierID = 999
			}
			require.Error(t, billRepo.NewImportBillRepository(f.db).ConfirmBillImportTransaction(bill, []entity.BillItem{item}, nil, "Owner"))
			f.assertStock(t, 0, 0)
		})
	}
	f := receiptSetup(t)
	f.receive(t, "FULL", f.line(f.customerLine, 4))
	bill := newTestBill("EXCESS", f.supplier.ID)
	bill.POID = &f.po.ID
	require.Error(t, billRepo.NewImportBillRepository(f.db).ConfirmBillImportTransaction(bill, []entity.BillItem{f.line(f.customerLine, 1)}, nil, "Owner"))
	f.assertStock(t, 4, 4)
}
func TestReceipt_UnlinkedSameProductIsShopStock(t *testing.T) {
	f := receiptSetup(t)
	bill := newTestBill("UNLINKED", f.supplier.ID)
	require.NoError(t, billRepo.NewImportBillRepository(f.db).ConfirmBillImportTransaction(bill, []entity.BillItem{newTestBillItem(f.product.ID, 100)}, nil, "Owner"))
	f.assertStock(t, 2, 0)
	require.Equal(t, "PENDING", f.status(t))
}
func TestReceipt_PreorderCancelAndHandover(t *testing.T) {
	for _, status := range []string{"CANCELLED", "COMPLETED"} {
		t.Run(status, func(t *testing.T) {
			f := receiptSetup(t)
			bill := f.receive(t, "CUSTOMER", f.line(f.customerLine, 4))
			f.receive(t, "SHOP", f.line(f.shopLine, 3))
			f.pre.Status = status
			require.NoError(t, preRepo.NewPreOrderRepository(f.db).UpdatePreOrder(&f.pre))
			if status == "CANCELLED" {
				f.assertStock(t, 7, 0)
			} else {
				f.assertStock(t, 3, 0)
				require.Error(t, billRepo.NewImportBillRepository(f.db).DeleteBill(bill.ID))
				require.Error(t, preRepo.NewPreOrderRepository(f.db).UpdatePreOrder(&f.pre))
				f.assertStock(t, 3, 0)
			}
		})
	}
}

func TestReceipt_MetadataEditAfterSaleDoesNotReplayStock(t *testing.T) {
	f := receiptSetup(t)
	bill := f.receive(t, "SHOP", f.line(f.shopLine, 5))
	require.NoError(t, f.db.Model(&entity.Product{}).Where("id = ?", f.product.ID).Update("quantity", 1).Error)
	require.NoError(t, f.db.Model(&entity.Inventory{}).Where("product_id = ?", f.product.ID).Update("inventory_quantity", 1).Error)
	bill.IsVerified = true
	require.NoError(t, billRepo.NewImportBillRepository(f.db).UpdateBill(bill.ID, bill, []entity.BillItem{f.line(f.shopLine, 5)}))
	f.assertStock(t, 1, 0)
}

func TestReceipt_CannotDeliverPartialOrDetachLinkedItems(t *testing.T) {
	f := receiptSetup(t)
	f.receive(t, "PARTIAL", f.line(f.customerLine, 1))
	repo := preRepo.NewPreOrderRepository(f.db)
	f.pre.Status = "COMPLETED"
	require.ErrorContains(t, repo.UpdatePreOrder(&f.pre), "ครบทุกรายการ")
	f.pre.Status = "PENDING"
	f.pre.PreOrderItems[0].Quantity = 1
	require.ErrorContains(t, repo.UpdatePreOrder(&f.pre), "ไม่สามารถแก้สินค้า")
	require.Error(t, repo.DeletePreOrder(f.pre.ID))
	f.assertStock(t, 1, 1)
}

func TestReceipt_ManualPreorderCreatesAndReservesProduct(t *testing.T) {
	f := receiptSetup(t)
	require.NoError(t, f.db.Model(&entity.PreOrderItem{}).Where("id = ?", f.pre.PreOrderItems[0].ID).Update("product_id", nil).Error)
	require.NoError(t, f.db.Model(&entity.POItems{}).Where("id = ?", f.customerLine.ID).Update("product_id", nil).Error)
	line := f.line(f.customerLine, 4)
	line.ProductID = 0
	line.CompanyProductName = "สินค้าใหม่สำหรับลูกค้า"
	line.CompanyProductCode = "NEW-PART"
	f.receive(t, "NEW", line)
	var receipt entity.BillItem
	require.NoError(t, f.db.Where("pre_order_item_id = ?", f.pre.PreOrderItems[0].ID).First(&receipt).Error)
	require.NotEqual(t, f.product.ID, receipt.ProductID)
	reserved, err := preorderstock.Reserved(f.db, receipt.ProductID, nil)
	require.NoError(t, err)
	require.Equal(t, 4, reserved)
	require.Equal(t, "READY", f.status(t))
}

func TestReceipt_BookingHeaderLocksOnPOApproval(t *testing.T) {
	for _, status := range []string{"DRAFT", "PENDING", "APPROVED"} {
		t.Run(status, func(t *testing.T) {
			f := receiptSetup(t)
			require.NoError(t, f.db.Model(&entity.PO{}).Where("id = ?", f.po.ID).Update("status", status).Error)
			f.pre.PreOrderType = "LINE"
			err := preRepo.NewPreOrderRepository(f.db).UpdatePreOrder(&f.pre)
			var saved entity.PreOrder
			require.NoError(t, f.db.First(&saved, f.pre.ID).Error)
			if status == "APPROVED" {
				require.ErrorContains(t, err, "อนุมัติแล้ว")
				require.Equal(t, "WALK_IN", saved.PreOrderType)
			} else {
				require.NoError(t, err)
				require.Equal(t, "LINE", saved.PreOrderType)
			}
			var po entity.PO
			require.NoError(t, f.db.First(&po, f.po.ID).Error)
			require.Equal(t, status, string(po.Status))
		})
	}
}
