package wms

import (
	"backend/internal/app/entity"
)

type ProductRequestDTO struct {
	Product_Code   string  `json:"product_code"` // Not required anymore because we can auto-generate it!
	Part_Number    string  `json:"part_number"`
	Product_Name   string  `json:"product_name" binding:"required"`
	Barcode        string  `json:"barcode"`
	Quantity       int     `json:"quantity" binding:"min=0"`
	Limit_Quantity int     `json:"limit_quantity" binding:"min=0"`
	Sale_price     float64 `json:"sale_price" binding:"required,gt=0"`
	Cost_price     float64 `json:"cost_price" binding:"required,gt=0"`
	Note           string  `json:"note"`

	// เพดานส่วนลดสูงสุดที่พนักงานขายหน้าร้าน (POS) กดลดให้สินค้าชิ้นนี้ได้ (%) — ฟิลด์นี้มีอยู่แล้วใน entity/products.go
	MaxDiscountRate float64 `json:"max_discount_rate"`

	ModelIDs         []uint `json:"model_ids" binding:"required"`
	UnitID           uint   `json:"unit_id" binding:"required"`
	CategoryID       uint   `json:"category_id" binding:"required"`
	SubCategoryID    *uint  `json:"sub_category_id"`
	SubSubCategoryID *uint  `json:"sub_sub_category_id"`
	GradeID          uint   `json:"grade_id" binding:"required"`
	ShelfID          uint   `json:"shelf_id" binding:"required"`
	ShelfLevelID     *uint  `json:"shelf_level_id"`
}

func (r *ProductRequestDTO) ToEntity() entity.Product {
	return entity.Product{
		Product_Code:     r.Product_Code,
		Part_Number:      r.Part_Number,
		Product_Name:     r.Product_Name,
		Barcode:          r.Barcode,
		Quantity:         r.Quantity,
		Limit_Quantity:   r.Limit_Quantity,
		Sale_price:       r.Sale_price,
		Cost_price:       r.Cost_price,
		Is_Active:        true, // กำหนดค่าเริ่มต้นให้เปิดใช้งานทันที
		Note:             r.Note,
		MaxDiscountRate:  r.MaxDiscountRate,
		UnitID:           r.UnitID,
		CategoryID:       r.CategoryID,
		SubCategoryID:    r.SubCategoryID,
		SubSubCategoryID: r.SubSubCategoryID,
		GradeID:          r.GradeID,
		ShelfID:          r.ShelfID,
		ShelfLevelID:     r.ShelfLevelID,
	}
}

type ProductListResponseDTO struct {
	ID              uint    `json:"id"`
	Product_Code    string  `json:"product_code"`
	Part_Number     string  `json:"part_number"`
	Product_Name    string  `json:"product_name"`
	Barcode         string  `json:"barcode"`
	Quantity        int     `json:"quantity"`
	Limit_Quantity  int     `json:"limit_quantity"`
	Sale_price      float64 `json:"sale_price"`
	Cost_price      float64 `json:"cost_price"`
	Is_Active       bool    `json:"is_active"`
	MaxDiscountRate float64 `json:"max_discount_rate"`
	Models          []struct {
		ID        uint   `json:"id"`
		ModelName string `json:"model_name"`
		BrandName string `json:"brand_name"`
	} `json:"models"`
	CategoryName       string `json:"category_name"`
	SubCategoryName    string `json:"sub_category_name"`
	SubSubCategoryName string `json:"sub_sub_category_name"`
	GradeName          string `json:"grade_name"`
	UnitName           string `json:"unit_name"`
	ShelfName          string `json:"shelf_name"`
	ShelfLevelName     string `json:"shelf_level_name"`
	ZoneName           string `json:"zone_name"`
	ThumbnailUrl       string `json:"thumbnail_url"`
	SupplierName       string `json:"supplier_name"`
	Note               string `json:"note"`
}

type ProductImageResponseDTO struct {
	ID        uint   `json:"id"`
	ProductID uint   `json:"product_id"`
	ImageURL  string `json:"image_url"`
}

// Helper function ใน DTO สำหรับแปลงข้อมูลยกชุด
func (d *ProductListResponseDTO) FromEntity(p entity.Product) {
	d.ID = p.ID
	d.Product_Code = p.Product_Code
	d.Part_Number = p.Part_Number
	d.Product_Name = p.Product_Name
	d.Barcode = p.Barcode
	d.Quantity = p.Quantity
	d.Limit_Quantity = p.Limit_Quantity
	d.Sale_price = p.Sale_price
	d.Cost_price = p.Cost_price
	d.Is_Active = p.Is_Active
	d.MaxDiscountRate = p.MaxDiscountRate

	d.Models = make([]struct {
		ID        uint   `json:"id"`
		ModelName string `json:"model_name"`
		BrandName string `json:"brand_name"`
	}, 0)
	for _, m := range p.Models {
		brandName := ""
		if m.Brand != nil {
			brandName = m.Brand.Brand_Name
		}
		d.Models = append(d.Models, struct {
			ID        uint   `json:"id"`
			ModelName string `json:"model_name"`
			BrandName string `json:"brand_name"`
		}{
			ID:        m.ID,
			ModelName: m.Model_Name,
			BrandName: brandName,
		})
	}
	d.CategoryName = ""
	if p.Category != nil {
		d.CategoryName = p.Category.Category_Name
	}
	d.SubCategoryName = ""
	if p.SubCategory != nil {
		d.SubCategoryName = p.SubCategory.Sub_Category_Name
	}
	d.SubSubCategoryName = ""
	if p.SubSubCategory != nil {
		d.SubSubCategoryName = p.SubSubCategory.Sub_Sub_Category_Name
	}

	d.GradeName = ""
	if p.Grade != nil {
		d.GradeName = p.Grade.Grade_Name
	}
	d.UnitName = p.Unit.Unit_Name
	d.ShelfName = ""
	d.ZoneName = ""
	if p.Shelf != nil {
		d.ShelfName = p.Shelf.Shelf_Name
		if p.Shelf.Zone != nil {
			d.ZoneName = p.Shelf.Zone.Zone_Name
		}
	}
	d.ShelfLevelName = ""
	if p.ShelfLevel != nil {
		d.ShelfLevelName = p.ShelfLevel.Level_Name
	}
	d.Note = p.Note

	if len(p.ProductImages) > 0 {
		d.ThumbnailUrl = p.ProductImages[0].Image_URL
	}

	if len(p.Inventories) > 0 && p.Inventories[0].Supplier != nil {
		d.SupplierName = p.Inventories[0].Supplier.SupplierName
	}
}
