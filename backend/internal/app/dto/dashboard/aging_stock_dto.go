package dashboard

import "time"

type AgingStockDTO struct {
	Rank         int        `json:"rank"`
	ProductCode  string     `json:"product_code"`
	ProductName  string     `json:"product_name"`
	LastSoldDate *time.Time `json:"last_sold_date"` // null = ไม่เคยขายเลย
	DaysAging    int        `json:"days_aging"`
	RemainingQty int        `json:"remaining_qty"`
	Unit         string     `json:"unit"`
	SunkValue    float64    `json:"sunk_value"` // cost_price * remaining_qty
}