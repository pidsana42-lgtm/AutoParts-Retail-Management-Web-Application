package pos // อยู่ในโฟลเดอร์ dto/pos

import "backend/internal/app/entity"

type POSProductResponse struct {
	ID              uint    `json:"id"`
	ProductCode     string  `json:"product_code"`
	PartNumber      string  `json:"part_number"`
	ProductName     string  `json:"product_name"`
	Barcode         string  `json:"barcode"`
	Quantity        int     `json:"quantity"`
	SalePrice       float64 `json:"sale_price"`
	Note            string  `json:"note"`
	MaxDiscountRate float64 `json:"max_discount_rate"`
	Grade_Name      string  `json:"grade_name"`
	Brand_Name      string  `json:"brand_name"`
	Model_Name      string  `json:"model_name"`
}

func ToPOSProductResponseList(products []entity.Product) []POSProductResponse {
	list := []POSProductResponse{}
	for _, p := range products {

		GradeName := ""
		if p.Grade != nil {
			GradeName = p.Grade.Grade_Name
		}

		BrandName := ""
		ModelName := ""

		for i, m := range p.Models {
			if i > 0 {
				ModelName += ", "
				BrandName += ", "
			}
			ModelName += m.Model_Name
			if m.Brand != nil {
				BrandName += m.Brand.Brand_Name
			}
		}

		list = append(list, POSProductResponse{
			ID:              p.ID,
			ProductCode:     p.Product_Code,
			PartNumber:      p.Part_Number,
			ProductName:     p.Product_Name,
			Barcode:         p.Barcode,
			Quantity:        p.Quantity,
			SalePrice:       p.Sale_price,
			MaxDiscountRate: p.MaxDiscountRate,
			Note:            p.Note,
			Grade_Name:      GradeName,
			Brand_Name:      BrandName,
			Model_Name:      ModelName,
		})
	}
	return list
}
