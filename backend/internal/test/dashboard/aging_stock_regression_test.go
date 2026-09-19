package dashboard_test

import (
	"context"
	"testing"
	"time"

	"backend/internal/app/entity"
	dashService "backend/internal/app/service/dashboard"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Permanent regression: a missing import date must not produce 106751 days.
func TestAgingStockMissingImportDate(t *testing.T) {
	repo := &fakeDashboardRepository{
		productsFn: func(context.Context) ([]entity.Product, error) {
			return []entity.Product{{
				Model:        gorm.Model{ID: 1, CreatedAt: time.Now()},
				Product_Code: "CREATED-TODAY", Quantity: 1,
				// Import_DateTime is absent, as can happen for imported new products.
			}}, nil
		},
	}
	rows, err := dashService.NewDashboardService(repo).GetAgingStock(context.Background(), 180)
	require.NoError(t, err)
	for _, row := range rows {
		t.Logf("product created today, import date absent: days_aging=%d", row.DaysAging)
	}
	require.Empty(t, rows, "a product created today with an unknown import date must not be reported as over 180 days old")
}

func TestAgingStockDateFallbacks(t *testing.T) {
	now := time.Now()
	old := now.Add(-200*24*time.Hour - time.Hour)
	recent := now.Add(-24*time.Hour - time.Hour)
	future := now.Add(24 * time.Hour)
	for _, tc := range []struct {
		name              string
		imported, created time.Time
		sold              *time.Time
		wantDays          int
	}{
		{"legacy product uses creation date", time.Time{}, old, nil, 200},
		{"import date takes precedence over creation", old, recent, nil, 200},
		{"recent sale resets inactivity", old, old, &recent, 0},
		{"old sale takes precedence", recent, recent, &old, 200},
		{"zero sale date ignored", old, recent, &time.Time{}, 200},
		{"all dates absent", time.Time{}, time.Time{}, nil, 0},
		{"future import date", future, old, nil, 0},
		{"future sale date", old, old, &future, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &fakeDashboardRepository{
				productsFn: func(context.Context) ([]entity.Product, error) {
					return []entity.Product{{Model: gorm.Model{ID: 1, CreatedAt: tc.created}, Product_Code: "TEST", Quantity: 1, Import_DateTime: tc.imported}}, nil
				},
				lastSoldFn: func(context.Context) (map[uint]time.Time, error) {
					if tc.sold != nil {
						return map[uint]time.Time{1: *tc.sold}, nil
					}
					return nil, nil
				},
			}
			rows, err := dashService.NewDashboardService(repo).GetAgingStock(context.Background(), 180)
			require.NoError(t, err)
			if tc.wantDays == 0 {
				require.Empty(t, rows)
			} else {
				require.Len(t, rows, 1)
				require.Equal(t, tc.wantDays, rows[0].DaysAging)
			}
		})
	}
}
