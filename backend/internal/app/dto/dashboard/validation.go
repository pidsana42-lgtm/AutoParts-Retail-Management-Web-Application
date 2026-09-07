package dashboard

import (
	"fmt"
	"time"
)

const dashboardDateLayout = "2006-01-02"

var allowedDebtStatuses = map[string]struct{}{
	"เกินกำหนด":   {},
	"ทยอยชำระ":    {},
	"ชำระหมดแล้ว": {},
}

func validateDate(field, value string) error {
	if value == "" {
		return nil
	}
	if _, err := time.Parse(dashboardDateLayout, value); err != nil {
		return fmt.Errorf("%s must use YYYY-MM-DD format", field)
	}
	return nil
}

func validateDateRange(startDate, endDate string) error {
	if err := validateDate("start_date", startDate); err != nil {
		return err
	}
	if err := validateDate("end_date", endDate); err != nil {
		return err
	}
	if startDate != "" && endDate != "" && startDate > endDate {
		return fmt.Errorf("start_date must not be after end_date")
	}
	return nil
}

// ValidateSummaryQuery validates all dashboard period filters at the API boundary.
func ValidateSummaryQuery(query SummaryQuery) error {
	if err := validateDate("summary_date", query.SummaryDate); err != nil {
		return err
	}
	if err := validateDate("ref_date", query.RefDate); err != nil {
		return err
	}
	if err := validateDateRange(query.StartDate, query.EndDate); err != nil {
		return err
	}
	if query.EndDate != "" && query.StartDate == "" {
		return fmt.Errorf("end_date requires start_date")
	}

	periods := []struct {
		name  string
		value string
	}{
		{"weekly_summary", query.Weekly},
		{"monthly_summary", query.Monthly},
		{"quarterly_summary", query.Quarterly},
		{"yearly_summary", query.Yearly},
	}

	activeFilters := 0
	if query.SummaryDate != "" {
		activeFilters++
	}
	if query.StartDate != "" || query.EndDate != "" {
		activeFilters++
	}
	for _, period := range periods {
		if period.value == "" {
			continue
		}
		if period.value != "1" {
			return fmt.Errorf("%s must equal 1", period.name)
		}
		activeFilters++
	}

	if activeFilters > 1 {
		return fmt.Errorf("only one dashboard period filter may be used at a time")
	}
	return nil
}

// ValidateDebtAgingQuery validates filters and pagination for debt-aging requests.
func ValidateDebtAgingQuery(query DebtAgingQuery) error {
	if err := validateDateRange(query.StartDate, query.EndDate); err != nil {
		return err
	}
	if query.Status != "" {
		if _, ok := allowedDebtStatuses[query.Status]; !ok {
			return fmt.Errorf("invalid debt-aging status")
		}
	}
	if query.MinAgeDays < 0 {
		return fmt.Errorf("min_age_days must not be negative")
	}
	if query.MaxAgeDays < 0 {
		return fmt.Errorf("max_age_days must not be negative")
	}
	if query.MinAgeDays > 0 && query.MaxAgeDays > 0 && query.MinAgeDays > query.MaxAgeDays {
		return fmt.Errorf("min_age_days must not exceed max_age_days")
	}
	if query.Page < 0 {
		return fmt.Errorf("page must be greater than zero")
	}
	if query.PageSize < 0 || query.PageSize > 100 {
		return fmt.Errorf("page_size must be between 1 and 100")
	}
	return nil
}

// ValidatePositiveInt validates scalar query parameters while allowing zero as
// the controller's "not supplied" value.
func ValidatePositiveInt(field string, value, maximum int) error {
	if value <= 0 {
		return fmt.Errorf("%s must be greater than zero", field)
	}
	if maximum > 0 && value > maximum {
		return fmt.Errorf("%s must not exceed %d", field, maximum)
	}
	return nil
}
