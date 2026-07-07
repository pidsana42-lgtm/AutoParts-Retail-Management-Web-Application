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

	BrandID       uint  `json:"brand_id" binding:"required"`
	UnitID        uint  `json:"unit_id" binding:"required"`
	CategoryID    uint  `json:"category_id" binding:"required"`
	SubCategoryID *uint `json:"sub_category_id"`
	GradeID       uint  `json:"grade_id" binding:"required"`
	ShelfID       uint  `json:"shelf_id" binding:"required"`
}

func (r *ProductRequestDTO) ToEntity() entity.Product {
	return entity.Product{
		Product_Code:   r.Product_Code,
		Part_Number:    r.Part_Number,
		Product_Name:   r.Product_Name,
		Barcode:        r.Barcode,
		Quantity:       r.Quantity,
		Limit_Quantity: r.Limit_Quantity,
		Sale_price:     r.Sale_price,
		Cost_price:     r.Cost_price,
		Is_Active:      true, // กำหนดค่าเริ่มต้นให้เปิดใช้งานทันที
		Note:           r.Note,
		BrandID:        r.BrandID,
		UnitID:         r.UnitID,
		CategoryID:     r.CategoryID,
		SubCategoryID:  r.SubCategoryID,
		GradeID:        r.GradeID,
		ShelfID:        r.ShelfID,
	}
}

type ProductListResponseDTO struct {
	ID              uint    `json:"id"`
	Product_Code    string  `json:"product_code"`
	Part_Number     string  `json:"part_number"`
	Product_Name    string  `json:"product_name"`
	Barcode         string  `json:"barcode"`
	Quantity        int     `json:"quantity"`
	Sale_price      float64 `json:"sale_price"`
	Is_Active       bool    `json:"is_active"`
	BrandName       string  `json:"brand_name"`
	CategoryName    string  `json:"category_name"`
	SubCategoryID   *uint   `json:"sub_category_id"`
	SubCategoryName string  `json:"sub_category_name"`
	UnitName        string  `json:"unit_name"`
	ShelfName       string  `json:"shelf_name"`
	ThumbnailUrl    string  `json:"thumbnail_url"`
}

// Helper function ใน DTO สำหรับแปลงข้อมูลยกชุด
func (d *ProductListResponseDTO) FromEntity(p entity.Product) {
	d.ID = p.ID
	d.Product_Code = p.Product_Code
	d.Part_Number = p.Part_Number
	d.Product_Name = p.Product_Name
	d.Barcode = p.Barcode
	d.Quantity = p.Quantity
	d.Sale_price = p.Sale_price
	d.Is_Active = p.Is_Active

	// สังเกต: พอลบ Pointer (*) ออกจาก Entity แล้ว 
	// สามารถจิ้มเข้าฟิลด์ .Brand_Name ได้ทันทีโดยไม่ต้องกลัว Nil Pointer Crash
	d.BrandName = p.Brand.Brand_Name
	d.CategoryName = p.Category.Category_Name
	d.SubCategoryID = p.SubCategoryID
	if p.SubCategory != nil {
		d.SubCategoryName = p.SubCategory.Sub_Category_Name
	}
	d.UnitName = p.Unit.Unit_Name
	d.ShelfName = p.Shelf.Shelf_Name

	if len(p.ProductImages) > 0 {
		d.ThumbnailUrl = p.ProductImages[0].Image_URL
	}
}

