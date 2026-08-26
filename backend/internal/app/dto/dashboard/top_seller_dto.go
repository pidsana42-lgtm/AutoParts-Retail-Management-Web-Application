package dashboard

type TopSellerDTO struct {
	ID           uint    `json:"id"`
	ProductName  string  `json:"product_name"`
	Category     string  `json:"category"`
	TotalSold    int     `json:"total_sold"`
	TotalRevenue float64 `json:"total_revenue"`
}
