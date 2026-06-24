package pos // อยู่ในโฟลเดอร์ dto/pos

import "backend/internal/app/entity"

type POSProductResponse struct {
	ID           uint    `json:"id"`
	ProductCode  string  `json:"product_code"`
	PartNumber   string  `json:"part_number"`
	ProductName  string  `json:"product_name"`
	Barcode      string  `json:"barcode"`
	Quantity     int     `json:"quantity"`
	SalePrice    float64 `json:"sale_price"`
	Note         string  `json:"note"`
}

func ToPOSProductResponseList(products []entity.Product) []POSProductResponse {
	list := []POSProductResponse{}
	for _, p := range products {
		list = append(list, POSProductResponse{
			ID:           p.ID,
			ProductCode:  p.Product_Code,
			PartNumber:   p.Part_Number,
			ProductName:  p.Product_Name,
			Barcode:      p.Barcode,
			Quantity:     p.Quantity,
			SalePrice:    p.Sale_price,
			Note:         p.Note,
		})
	}
	return list
}