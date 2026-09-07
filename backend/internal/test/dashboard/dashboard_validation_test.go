package dashboard_test

import (
	"testing"

	dashDTO "backend/internal/app/dto/dashboard"
)

func TestValidateSummaryQuery(t *testing.T) {
	tests := []struct {
		name    string
		query   dashDTO.SummaryQuery
		wantErr bool
	}{
		{"empty uses default", dashDTO.SummaryQuery{}, false},
		{"single date", dashDTO.SummaryQuery{SummaryDate: "2026-09-07"}, false},
		{"date range", dashDTO.SummaryQuery{StartDate: "2026-09-01", EndDate: "2026-09-07"}, false},
		{"period with reference date", dashDTO.SummaryQuery{Monthly: "1", RefDate: "2026-08-01"}, false},
		{"invalid date format", dashDTO.SummaryQuery{SummaryDate: "07-09-2026"}, true},
		{"impossible date", dashDTO.SummaryQuery{SummaryDate: "2026-02-30"}, true},
		{"reversed range", dashDTO.SummaryQuery{StartDate: "2026-09-08", EndDate: "2026-09-07"}, true},
		{"end date without start", dashDTO.SummaryQuery{EndDate: "2026-09-07"}, true},
		{"invalid period value", dashDTO.SummaryQuery{Weekly: "yes"}, true},
		{"conflicting filters", dashDTO.SummaryQuery{SummaryDate: "2026-09-07", Monthly: "1"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := dashDTO.ValidateSummaryQuery(tt.query)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateSummaryQuery() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidateDebtAgingQuery(t *testing.T) {
	tests := []struct {
		name    string
		query   dashDTO.DebtAgingQuery
		wantErr bool
	}{
		{"valid", dashDTO.DebtAgingQuery{Status: "เกินกำหนด", MinAgeDays: 31, MaxAgeDays: 60, Page: 1, PageSize: 100}, false},
		{"defaults", dashDTO.DebtAgingQuery{}, false},
		{"unknown status", dashDTO.DebtAgingQuery{Status: "unknown"}, true},
		{"negative minimum", dashDTO.DebtAgingQuery{MinAgeDays: -1}, true},
		{"reversed age range", dashDTO.DebtAgingQuery{MinAgeDays: 61, MaxAgeDays: 60}, true},
		{"negative page", dashDTO.DebtAgingQuery{Page: -1}, true},
		{"oversized page", dashDTO.DebtAgingQuery{PageSize: 101}, true},
		{"reversed dates", dashDTO.DebtAgingQuery{StartDate: "2026-09-08", EndDate: "2026-09-07"}, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := dashDTO.ValidateDebtAgingQuery(tt.query)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ValidateDebtAgingQuery() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestValidatePositiveInt(t *testing.T) {
	if err := dashDTO.ValidatePositiveInt("limit", 100, 100); err != nil {
		t.Fatalf("expected boundary value to be accepted: %v", err)
	}
	for _, value := range []int{-1, 0, 101} {
		if err := dashDTO.ValidatePositiveInt("limit", value, 100); err == nil {
			t.Errorf("expected value %d to be rejected", value)
		}
	}
}
