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
	// Suppliers: รายละเอียดรหัส/บาร์โค้ดแยกตาม Supplier แต่ละเจ้า (จากตาราง Inventory) — หน้าบ้านใช้เทียบว่าคำค้นหา/
	// บาร์โค้ดที่แสกนตรงกับเจ้าไหนเจาะจงไหม เพื่อผูกการขายชิ้นนี้กับ Supplier นั้น แล้วหักคงเหลือต่อบริษัทให้ตรง
	Suppliers []POSProductSupplierInfo `json:"suppliers"`
}

// POSProductSupplierInfo: รหัสของสินค้าตัวนี้ตามที่ Supplier แต่ละเจ้าใช้ (บาร์โค้ด/รหัสล็อต/รหัสบริษัท)
type POSProductSupplierInfo struct {
	SupplierID         uint   `json:"supplier_id"`
	SupplierName       string `json:"supplier_name"`
	Barcode            string `json:"barcode"`
	VariantCode        string `json:"variant_code"`
	CompanyProductCode string `json:"company_product_code"`
	// Quantity: คงเหลือของสินค้าตัวนี้เฉพาะที่รับมาจากบริษัทนี้เจ้าเดียว (จาก Inventory.Inventory_Quantity)
	// ไม่ใช่ยอดรวมทั้งร้าน — ใช้โชว์/จำกัดจำนวนตอนขายระบุเจาะจงว่ามาจากบริษัทนี้
	Quantity int `json:"quantity"`
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

		// ไม่มีบาร์โค้ดกลางของสินค้าเองแล้ว (ย้ายไปผูกกับ Supplier แต่ละเจ้าใน Inventory แทน) — ใช้ของเจ้าแรกที่มี แล้วค่อย fallback เป็นรหัสสินค้า
		barcode := ""
		if len(p.Inventories) > 0 {
			for _, inv := range p.Inventories {
				if inv.Barcode != "" {
					barcode = inv.Barcode
					break
				}
				if inv.Variant_Code != "" {
					barcode = inv.Variant_Code
					break
				}
			}
		}
		if barcode == "" {
			barcode = p.Product_Code
		}

		suppliers := make([]POSProductSupplierInfo, 0, len(p.Inventories))
		for _, inv := range p.Inventories {
			name := ""
			if inv.Supplier != nil {
				name = inv.Supplier.SupplierName
			}
			suppliers = append(suppliers, POSProductSupplierInfo{
				SupplierID:         inv.SupplierID,
				SupplierName:       name,
				Barcode:            inv.Barcode,
				VariantCode:        inv.Variant_Code,
				CompanyProductCode: inv.CompanyProductCode,
				Quantity:           inv.Inventory_Quantity,
			})
		}

		list = append(list, POSProductResponse{
			ID:              p.ID,
			ProductCode:     p.Product_Code,
			PartNumber:      p.Part_Number,
			ProductName:     p.Product_Name,
			Barcode:         barcode,
			Quantity:        p.Quantity,
			SalePrice:       p.Sale_price,
			MaxDiscountRate: p.MaxDiscountRate,
			Note:            p.Note,
			Grade_Name:      GradeName,
			Brand_Name:      BrandName,
			Model_Name:      ModelName,
			Suppliers:       suppliers,
		})
	}
	return list
}
