package importbill

import (
	"testing"
	"time"

	"backend/internal/app/entity"
	billRepo "backend/internal/app/repository/import_data"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestNewImportedProductUsesReceiptDate(t *testing.T) {
	for _, receipt := range []time.Time{time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC), {}} {
		t.Run(receipt.String(), func(t *testing.T) {
			db := setupImportBillTestDB(t)
			_, supplier := seedProductForImport(t, db, 100)
			bill := newTestBill("AGING-IMPORT", supplier.ID)
			bill.ReceiveDate = receipt
			item := newTestBillItem(0, 150)
			item.CompanyProductName = "New aging test product"
			item.CompanyProductCode = "NEW-AGING-1"
			before := time.Now()
			require.NoError(t, billRepo.NewImportBillRepository(db).ConfirmBillImportTransaction(bill, []entity.BillItem{item}, nil, "Owner"))
			var product entity.Product
			require.NoError(t, db.Where("product_name = ?", item.CompanyProductName).First(&product).Error)
			if receipt.IsZero() {
				// GORM/database timestamps may be rounded to millisecond precision.
				require.WithinDuration(t, before, product.Import_DateTime, time.Second)
			} else {
				require.True(t, receipt.Equal(product.Import_DateTime))
			}
		})
	}
}

func TestProductCreationInitializesMissingImportDate(t *testing.T) {
	db := setupImportBillTestDB(t)
	created := time.Date(2025, 3, 1, 0, 0, 0, 0, time.UTC)
	provided := created.Add(24 * time.Hour)
	for _, tc := range []struct {
		code           string
		imported, want time.Time
	}{
		{"CREATION-FALLBACK", time.Time{}, created},
		{"KEEP-RECEIPT", provided, provided},
	} {
		p := entity.Product{Model: gorm.Model{CreatedAt: created}, Product_Code: tc.code, Import_DateTime: tc.imported}
		require.NoError(t, db.Create(&p).Error)
		var saved entity.Product
		require.NoError(t, db.First(&saved, p.ID).Error)
		require.True(t, tc.want.Equal(saved.Import_DateTime), tc.code)
	}
}
