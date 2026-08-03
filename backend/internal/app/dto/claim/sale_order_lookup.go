package claim

import "time"

type SaleOrderItemLookupDTO struct {
	ProductID   uint    `json:"product_id"`
	ProductName string  `json:"product_name"`
	PartNumber  string  `json:"part_number"`
	Qty         int     `json:"qty"`
	Unit        string  `json:"unit"`
	UnitPrice   float64 `json:"unit_price"`
	Subtotal    float64 `json:"subtotal"`
}

type SaleOrderLookupDTO struct {
	ID                uint                     `json:"id"`
	OrderNumber       string                   `json:"order_number"`
	OrderDate         time.Time                `json:"order_date"`
	CustomerID        *uint                    `json:"customer_id"`
	CustomerName      string                   `json:"customer_name"`
	CustomerPhone     string                   `json:"customer_phone"`
	TotalAmount       float64                  `json:"total_amount"`
	Status            string                   `json:"status"`
	Items             []SaleOrderItemLookupDTO `json:"items"`
}
