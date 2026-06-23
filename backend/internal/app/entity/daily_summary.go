package entity

import (
	"gorm.io/gorm"
	"time"
)

type DailySummary struct {
	gorm.Model
	SummaryDate 			time.Time			`gorm:"type:date;not null;unique" json:"summary_date"`
	TotalOrders				int					`gorm:"not null;default:0" json:"total_orders"`
	TotalItemsSold			int 				`gorm:"not null;default:0" json:"total_items_sold"`
	OverdueDebtCount		int 				`gorm:"not null;default:0" json:"overdue_debt_count"`

	TotalRevenue			float64				`gorm:"type:decimal(15,2);not null;default:0" json:"total_revenue"`
	TotalCost				float64				`gorm:"type:decimal(15,2);not null;default:0" json:"total_cost"`
	GrossProfit				float64				`gorm:"type:decimal(15,2);not null;default:0" json:"gross_profit"`
	MarginPercent			float64				`gorm:"type:decimal(5,2);not null;default:0" json:"margin_percent"`
	CashAmount				float64				`gorm:"type:decimal(15,2);not null;default:0" json:"cash_amount"`
	TransferAmount			float64				`gorm:"type:decimal(15,2);not null;default:0" json:"transfer_amount"`
	CreditAmount			float64				`gorm:"type:decimal(15,2);not null;default:0" json:"credit_amount"`
	WalkinCustomerAmount	float64				`gorm:"type:decimal(15,2);not null;default:0" json:"walkin_customer_amount"`
	GarageCustomerAmount	float64				`gorm:"type:decimal(15,2);not null;default:0" json:"garage_customer_amount"`
	CorporateCustomerAmount	float64				`gorm:"type:decimal(15,2);not null;default:0" json:"corporate_customer_amount"`
	ReturnAmount 			float64				`gorm:"type:decimal(15,2);not null;default:0" json:"returns_amount"`
	CollectedDebtAmount		float64				`gorm:"type:decimal(15,2);not null;default:0" json:"collected_debt_amount"`
	TotalOutstandingDebt	float64				`gorm:"type:decimal(15,2);not null;default:0" json:"total_outstanding_amount"`
}

func (DailySummary) TableName() string {
	return "daily_sales_summary"
}