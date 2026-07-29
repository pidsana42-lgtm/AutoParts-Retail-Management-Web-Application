package import_data

type UpdateImportProductDTO struct {
	ProductCode   string  `json:"product_code"`
	PartNumber    string  `json:"part_number"`
	ProductName   string  `json:"product_name"`
	Barcode       string  `json:"barcode"`
	Quantity      int     `json:"quantity"`
	LimitQuantity int     `json:"limit_quantity"`
	CostPrice     float64 `json:"cost_price"`
	SalePrice     float64 `json:"sale_price"`
	Note          string  `json:"note"`
	ModelIDs      []uint  `json:"model_ids"`
	CategoryID    uint    `json:"category_id"`
	GradeID       uint    `json:"grade_id"`
	UnitID        uint    `json:"unit_id"`
	ShelfID       uint    `json:"shelf_id"`
}
