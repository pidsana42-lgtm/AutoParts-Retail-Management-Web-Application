package purchase

import (
	"context"
	"testing"

	dto "backend/internal/app/dto/purchase_orders"
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	preorderRepo "backend/internal/app/repository/pre_oder"
	poRepo "backend/internal/app/repository/purchase_orders"
	service "backend/internal/app/service/purchase_orders"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func TestManualPreorderCreateAndEditWithoutWMSProduct(t *testing.T) {
	var saved *entity.PO
	writes := 0
	repo := &mockPORepo{
		save:   func(po *entity.PO) error { po.ID = 42; saved = po; writes++; return nil },
		get:    func(uint) (*entity.PO, error) { return saved, nil },
		reload: func(uint) (*entity.PO, error) { return saved, nil },
		update: func(*entity.PO) error { writes++; return nil },
		sync:   func(_ uint, items []entity.POItems) error { saved.PO_Items = items; writes++; return nil },
	}
	pre := &mockPreorder{
		get: func(id uint) (*entity.PreOrderItem, error) {
			if id != 8 {
				return nil, gorm.ErrRecordNotFound
			}
			return &entity.PreOrderItem{Model: gorm.Model{ID: 8}, PreOrder: &entity.PreOrder{}, ProductNameSnapshot: "ekdmlkdmskl", Quantity: 2}, nil
		},
		update: func([]uint, string) error { return nil },
	}
	supplier := &mockSupplier{get: func(uint) (*entity.Supplier, error) { return &entity.Supplier{}, nil }}
	// No product repository: looking up/inventing a WMS product would panic.
	svc := service.NewPOService(repo, nil, nil, supplier, pre, nil, nil, nil)
	created, err := svc.CreatePO(context.Background(), &dto.CreatePurchaseOrderRequest{
		SupplierID: 7, Status: enum.StatusDraft,
		POItems: []dto.POItemDTO{{ProductID: 0, PreOrderItemID: ptr(uint(8)), Quantity: 2, UnitPrice: 0}},
	}, 1)
	require.NoError(t, err)
	require.Nil(t, saved.PO_Items[0].ProductID)
	require.Zero(t, created.POItems[0].ProductID)
	require.Equal(t, "ekdmlkdmskl", created.POItems[0].ProductNameSnapshot)
	require.Empty(t, created.POItems[0].SupplyProductCodeSnapshot)
	require.Zero(t, created.TotalAmount)

	edited, err := svc.UpdatePO(context.Background(), 42, &dto.UpdatePurchaseOrderRequest{
		Items: []dto.UpdatePOItemRequest{{ProductID: 0, PreOrderItemID: ptr(uint(8)), Quantity: 3, UnitPrice: 0}},
	}, 1)
	require.NoError(t, err)
	require.Nil(t, edited.PO_Items[0].ProductID)
	require.Equal(t, float64(3), edited.PO_Items[0].Quantity)
	require.Equal(t, "ekdmlkdmskl", edited.PO_Items[0].Product_name_snapshot)

	before := writes
	_, err = svc.UpdatePO(context.Background(), 42, &dto.UpdatePurchaseOrderRequest{
		Notes: ptr("must not be saved"), Items: []dto.UpdatePOItemRequest{{ProductID: 0, PreOrderItemID: ptr(uint(999)), Quantity: 1}},
	}, 1)
	require.Error(t, err)
	require.Equal(t, before, writes, "invalid preorder must not partially save the header")
}

func TestManualPreorderNullableMigrationAndPersistence(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent), DisableForeignKeyConstraintWhenMigrating: true})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(1)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	// Start with the old NOT NULL schema and an existing product-linked item.
	require.NoError(t, db.Exec("CREATE TABLE products (id integer PRIMARY KEY)").Error)
	require.NoError(t, db.Exec(`CREATE TABLE purchase_order_items (
		id integer PRIMARY KEY, product_id integer NOT NULL REFERENCES products(id),
		created_at datetime, updated_at datetime, deleted_at datetime,
		po_id integer NOT NULL, product_name_snapshot text NOT NULL,
		supply_product_code_snapshot text NOT NULL, quantity decimal(10,2) NOT NULL,
		unit text NOT NULL, unit_price decimal(10,2) NOT NULL, sub_total decimal(10,2) NOT NULL
	)`).Error)
	require.NoError(t, db.Exec("INSERT INTO products (id) VALUES (3)").Error)
	require.NoError(t, db.Exec("INSERT INTO purchase_order_items (id, product_id, po_id, product_name_snapshot, supply_product_code_snapshot, quantity, unit, unit_price, sub_total) VALUES (1, 3, 9, 'Existing', 'P3', 1, 'piece', 10, 10)").Error)
	require.NoError(t, db.AutoMigrate(&entity.POItems{}))
	require.NoError(t, db.Exec("PRAGMA foreign_keys = ON").Error)
	var legacy entity.POItems
	require.NoError(t, db.First(&legacy, 1).Error)
	require.NotNil(t, legacy.ProductID)
	require.EqualValues(t, 3, *legacy.ProductID)

	po := entity.PreOrder{Model: gorm.Model{ID: 1}}
	require.NoError(t, db.Create(&po).Error)
	pre := entity.PreOrderItem{PreOrderID: po.ID, ProductNameSnapshot: "ekdmlkdmskl", Quantity: 2}
	require.NoError(t, db.Create(&pre).Error)
	loaded, err := preorderRepo.NewPreOrderRepository(db).GetPreOrderItemByID(context.Background(), pre.ID)
	require.NoError(t, err)
	require.Nil(t, loaded.ProductID)
	require.NotNil(t, loaded.PreOrder)

	item := entity.POItems{POID: 7, ProductID: nil, PreOrderItemID: &pre.ID, Product_name_snapshot: loaded.ProductNameSnapshot, Quantity: 2, Unit: "ชิ้น"}
	require.NoError(t, db.Create(&item).Error)
	item.Quantity = 3
	require.NoError(t, poRepo.NewPORepository(db).SyncItems(context.Background(), 7, []entity.POItems{item}))
	var saved entity.POItems
	require.NoError(t, db.First(&saved, item.ID).Error)
	require.Nil(t, saved.ProductID)
	require.Equal(t, "ekdmlkdmskl", saved.Product_name_snapshot)
	require.Zero(t, saved.UnitPrice)
	var count int64
	require.NoError(t, db.Model(&entity.POItems{}).Where("id = ? AND product_id IS NULL", item.ID).Count(&count).Error)
	require.EqualValues(t, 1, count)
}
