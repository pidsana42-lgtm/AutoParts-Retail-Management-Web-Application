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