package wms

import (
	"strings"
	"time"

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

	// สินค้าชิ้นนี้รับมาจาก Supplier ไหนบ้าง (1 สินค้ามีได้หลายเจ้า แยกจำนวนต่อเจ้า) — ไม่บังคับ เผื่อยังไม่ทราบตอนเพิ่มสินค้า
	Suppliers []ProductSupplierInput `json:"suppliers"`
}

// ProductSupplierInput: ผู้จำหน่าย 1 รายที่สินค้านี้รับมาจาก พร้อมจำนวนที่รับจากเจ้านั้น
type ProductSupplierInput struct {
	SupplierID uint `json:"supplier_id" binding:"required"`
	Quantity   int  `json:"quantity" binding:"min=0"`
	// CompanyProductCode: รหัสสินค้าตามที่ Supplier เจ้านี้ใช้เรียกสินค้าชิ้นนี้ (ไม่บังคับ)
	CompanyProductCode string `json:"company_product_code"`
}

// ReceiveStockRequestDTO: รับสินค้าเข้าเพิ่มให้สินค้าที่มีอยู่แล้วในระบบ (ไม่ใช่สร้างสินค้าใหม่)
// บวกจำนวนที่รับเพิ่มเข้ากับยอดคงเหลือเดิม + บวกจำนวนต่อ Supplier เข้ากับของเดิม (ไม่ใช่แทนที่)
type ReceiveStockRequestDTO struct {
	Quantity  int                    `json:"quantity" binding:"required,gt=0"`
	Suppliers []ProductSupplierInput `json:"suppliers"`
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
	ID           uint   `json:"id"`
	Product_Code string `json:"product_code"`
	Part_Number  string `json:"part_number"`
	// CompanyProductCode ของสินค้าทั้งชิ้นเป็นค่าเดียวไม่ได้อีกแล้ว เพราะ 1 สินค้ามาได้จากหลาย Supplier
	// แต่ละเจ้าใช้รหัสของตัวเองไม่เหมือนกัน — ดูได้ที่ Suppliers[].CompanyProductCode แทน (แยกตามเจ้า)
	Product_Name string  `json:"product_name"`
	Barcode            string  `json:"barcode"`
	Quantity           int     `json:"quantity"`
	Limit_Quantity     int     `json:"limit_quantity"`
	Sale_price         float64 `json:"sale_price"`
	Cost_price         float64 `json:"cost_price"`
	Is_Active          bool    `json:"is_active"`
	MaxDiscountRate    float64 `json:"max_discount_rate"`
	Models             []struct {
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
	// SupplierName: รวมชื่อ Supplier ทุกเจ้าที่สินค้านี้รับมาจาก คั่นด้วย ", " (เผื่อหน้าตาราง/ตัวกรองเดิมที่คาดหวังค่าเดียว)
	SupplierName string                       `json:"supplier_name"`
	Suppliers    []ProductSupplierResponseDTO `json:"suppliers"`
	Note         string                     `json:"note"`
	// DeletedAt: มีค่าเฉพาะตอนดึงรายการ "สินค้าที่ถูกลบ" (ถังขยะ) เท่านั้น ไว้โชว์วันที่ลบให้เจ้าของร้านดู
	DeletedAt *time.Time `json:"deleted_at,omitempty"`
}

// ProductSupplierResponseDTO: รายละเอียด Supplier แต่ละเจ้าที่สินค้านี้รับมาจาก (จากตาราง Inventory)
type ProductSupplierResponseDTO struct {
	SupplierID         uint   `json:"supplier_id"`
	SupplierName       string `json:"supplier_name"`
	Quantity           int    `json:"quantity"`
	CompanyProductCode string `json:"company_product_code"`
	// VariantCode: รหัสล็อตต่อบริษัทที่ระบบออกให้อัตโนมัติ (เช่น BP-123-SU3) ใช้พิมพ์ QR/บาร์โค้ดแยกบริษัท
	VariantCode string `json:"variant_code"`
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

	if p.DeletedAt.Valid {
		deletedAt := p.DeletedAt.Time
		d.DeletedAt = &deletedAt
	}

	if len(p.ProductImages) > 0 {
		d.ThumbnailUrl = p.ProductImages[0].Image_URL
	}

	d.Suppliers = make([]ProductSupplierResponseDTO, 0, len(p.Inventories))
	supplierNames := make([]string, 0, len(p.Inventories))
	for _, inv := range p.Inventories {
		name := ""
		if inv.Supplier != nil {
			name = inv.Supplier.SupplierName
		}
		d.Suppliers = append(d.Suppliers, ProductSupplierResponseDTO{
			SupplierID:         inv.SupplierID,
			SupplierName:       name,
			Quantity:           inv.Inventory_Quantity,
			CompanyProductCode: inv.CompanyProductCode,
			VariantCode:        inv.Variant_Code,
		})
		if name != "" {
			supplierNames = append(supplierNames, name)
		}
	}
	d.SupplierName = strings.Join(supplierNames, ", ")
}
