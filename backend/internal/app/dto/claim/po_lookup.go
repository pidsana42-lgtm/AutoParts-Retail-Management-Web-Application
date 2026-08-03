package claim

type POItemLookupDTO struct {
	ProductID          uint    `json:"product_id"`
	ProductName        string  `json:"product_name"`
	SupplyProductCode  string  `json:"supply_product_code"`
	Quantity           float64 `json:"quantity"`
	Unit               string  `json:"unit"`
	UnitPrice          float64 `json:"unit_price"`
	SubTotal           float64 `json:"sub_total"`
}

type POLookupDTO struct {
	ID           uint              `json:"id"`
	PONumber     string            `json:"po_number"`
	Status       string            `json:"status"`
	TotalAmount  float64           `json:"total_amount"`
	SupplierID   uint              `json:"supplier_id"`
	SupplierName string            `json:"supplier_name"`
	Items        []POItemLookupDTO `json:"items"`
}
