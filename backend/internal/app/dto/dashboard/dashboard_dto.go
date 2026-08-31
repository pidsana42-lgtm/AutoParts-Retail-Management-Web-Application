package dashboard

import "time"

// Debt Aging

type DebtAgingQuery struct {
	StartDate  string `form:"start_date"`
	EndDate    string `form:"end_date"`
	Status     string `form:"status"`       // "เกินกำหนด" | "ทยอยชำระ" | "" (all)
	MinAgeDays int    `form:"min_age_days"` // 0 = no lower bound
	MaxAgeDays int    `form:"max_age_days"` // 0 = no upper bound
	Page       int    `form:"page"`
	PageSize   int    `form:"page_size"`
}

type DebtAgingItemDTO struct {
	CustomerCode     string  `json:"customer_code"`
	CustomerName     string  `json:"customer_name"`
	TotalDebt        float64 `json:"total_debt"`        // SUM(total_amount)
	RemainingBalance float64 `json:"remaining_balance"` // SUM(balance_due)
	LastPurchaseDate string  `json:"last_purchase_date"`
	AgeDays          int     `json:"age_days"`
	Status           string  `json:"status"` // "ทยอยชำระ" | "เกินกำหนด" | "ชำระหมดแล้ว"
}

type DebtAgingResponse struct {
	Data         []DebtAgingItemDTO `json:"data"`
	Total        int64              `json:"total"`
	TotalDebtors int64              `json:"total_debtors"`
	YearlyTarget float64            `json:"yearly_target"`
}

type DisplayDashboardDTO struct {
	SummaryDate             time.Time `json:"summary_date"`
	TotalOrders             int       `json:"total_orders"`
	TotalItemsSold          int       `json:"total_items_sold"`
	OverdueDebtCount        int       `json:"overdue_debt_count"`
	TotalRevenue            float64   `json:"total_revenue"`
	NetRevenue              float64   `json:"net_revenue"`
	TotalCost               float64   `json:"total_cost"`
	GrossProfit             float64   `json:"gross_profit"`
	MarginPercent           float64   `json:"margin_profit"`
	CashAmount              float64   `json:"cash_amount"`
	TransferAmount          float64   `json:"transfer_amount"`
	CreditAmount            float64   `json:"credit_amount"`
	WalkinCustomerAmount    float64   `json:"walkin_customer_amount"`
	GarageCustomerAmount    float64   `json:"garage_customer_amount"`
	CorporateCustomerAmount float64   `json:"corporate_customer_amount"`
	ReturnAmount            float64   `json:"return_amount"`
	CollectedDebtAmount     float64   `json:"collected_debt_amount"`
	TotalOutstandingDebt    float64   `json:"total_outstanding_amount"`
}

type SummaryQuery struct {
	SummaryDate string `form:"summary_date"`
	Weekly      string `form:"weekly_summary"`
	Monthly     string `form:"monthly_summary"`
	Quarterly   string `form:"quarterly_summary"`
	Yearly      string `form:"yearly_summary"`
	RefDate     string `form:"ref_date"` // anchor date for previous-period queries
}

type SummaryResponse struct {
	SummaryData []DisplayDashboardDTO `json:"summary_data"`
	Total       int64                 `json:"total"`
}

type StockHealthDTO struct {
	TotalProducts   int64   `json:"total_products"`
	HealthyCount    int64   `json:"healthy_count"`
	LowStockCount   int64   `json:"low_stock_count"`
	OutOfStockCount int64   `json:"out_of_stock_count"`
	HealthPercent   float64 `json:"health_percent"`
}
