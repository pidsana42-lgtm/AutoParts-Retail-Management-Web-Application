package dashboard

import "time"

type RecentSaleDTO struct {
	ID            	uint      	`json:"id"`
	OrderNumber   	string    	`json:"order_number"`
	Time          	time.Time 	`json:"time"`
	TotalAmount   	float64   	`json:"total_amount"`
	OrderStatus   	string    	`json:"order_status"`
	PaymentMethod 	string    	`json:"payment_method"`
}

type SummaryIncomeQuery struct {
	SummaryDate      string `form:"summary_date"`
	WeeklySummary    string `form:"weekly_summary"`
	MonthlySummary   string `form:"monthly_summary"`
	QuarterlySummary string `form:"quarterly_summary"`
	YearlySummary    string `form:"yearly_summary"`
	RefDate          string `form:"ref_date"`
}

type ChartDatumDTO struct {
	Name  string  `json:"name"`
	Value float64 `json:"value"`
	Fill  string  `json:"fill"`
}

type RevenueBreakdownResponse struct {
	CustomerData []ChartDatumDTO `json:"customerData"`
	PaymentData  []ChartDatumDTO `json:"paymentData"`
}