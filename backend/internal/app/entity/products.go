package entity

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

type Product struct {
	gorm.Model
	Product_Code    string    `json:"product_code"`
	Part_Number     string    `json:"part_number"`
	Product_Name    string    `json:"product_name"`
	Quantity        int       `json:"quantity"`
	Limit_Quantity  int       `json:"limit_quantity"`
	Sale_price      float64   `json:"sale_price"`
	Cost_price      float64   `json:"cost_price"`
	Is_Active       bool      `json:"is_active"`
	Import_DateTime time.Time `json:"import_datetime"`
	Note            string    `json:"note"`

	UnitID           uint  `json:"unit_id"`
	CategoryID       uint  `json:"category_id"`
	SubCategoryID    *uint `json:"sub_category_id" gorm:"default:null"`
	SubSubCategoryID *uint `json:"sub_sub_category_id" gorm:"default:null"`
	GradeID          uint  `json:"grade_id"`
	ShelfID          uint  `json:"shelf_id"`
	ShelfLevelID     *uint `json:"shelf_level_id" gorm:"default:null"`
	// CompanyProductCode ย้ายไปอยู่ที่ entity.Inventory แล้ว (ผูกกับ Supplier แต่ละเจ้าแทน) เพราะสินค้า 1 ชื่อ
	// ในร้านมาได้จากหลายบริษัท แต่ละเจ้าใช้รหัสสินค้าของตัวเองไม่เหมือนกัน เก็บไว้ที่ Product เดียวไม่ครอบคลุม

	Models         []Models        `gorm:"many2many:product_models;" json:"models"`
	Unit           *Unit           `gorm:"foreignKey:UnitID" json:"unit"`
	Category       *Category       `gorm:"foreignKey:CategoryID" json:"category"`
	SubCategory    *SubCategory    `gorm:"foreignKey:SubCategoryID" json:"sub_category"`
	SubSubCategory *SubSubCategory `gorm:"foreignKey:SubSubCategoryID" json:"sub_sub_category"`
	Grade          *Grade          `gorm:"foreignKey:GradeID" json:"grade"`
	Shelf          *Shelf          `gorm:"foreignKey:ShelfID" json:"shelf"`
	ShelfLevel     *ShelfLevel     `gorm:"foreignKey:ShelfLevelID" json:"shelf_level"`

	StockAlerts    []StockAlert    `gorm:"foreignKey:ProductID" json:"stock_alerts"`
	Inventories    []Inventory     `gorm:"foreignKey:ProductID" json:"inventories"`
	CheckStocks    []CheckStock    `gorm:"foreignKey:ProductID" json:"check_stocks"`
	ProductImages  []ProductImage  `gorm:"foreignKey:ProductID" json:"product_images"`
	StockMovements []StockMovement `gorm:"foreignKey:ProductID" json:"stock_movements"`
	BillItems      []BillItem      `gorm:"foreignKey:ProductID" json:"bill_items"`
	QRCodes        []ProductQRCode `gorm:"foreignKey:ProductID" json:"qr_codes"`

	// เพิ่มฟิลด์นี้เพื่อให้ Product เซ็ตเพดานส่วนลดของแต่ละชิ้น
	MaxDiscountRate float64 `gorm:"type:decimal(5,2);not null;default:0.00" json:"max_discount_rate"`
}

func (p *Product) BeforeCreate(tx *gorm.DB) error {
	// New products must have a usable aging date, including manual stock entry.
	// Import flows can supply the actual receipt date before this hook runs.
	if p.Import_DateTime.IsZero() {
		p.Import_DateTime = p.CreatedAt
		if p.Import_DateTime.IsZero() {
			p.Import_DateTime = time.Now()
		}
	}
	if p.Product_Code != "" {
		return nil
	}

	// 1. Fetch Category details
	var category Category
	if err := tx.First(&category, p.CategoryID).Error; err != nil {
		return fmt.Errorf("invalid category ID: %v", err)
	}

	catPrefix := strings.ToUpper(strings.TrimSpace(category.Category_Short_Name))
	if catPrefix == "" {
		// Fallback: Use first 3 letters of Category_Name
		cleanName := strings.ReplaceAll(category.Category_Name, " ", "")
		if len(cleanName) >= 3 {
			catPrefix = strings.ToUpper(cleanName[:3])
		} else {
			catPrefix = "CAT"
		}
	}

	// 2. Fetch SubCategory details (if SubCategoryID is provided)
	subPrefix := ""
	if p.SubCategoryID != nil && *p.SubCategoryID > 0 {
		var subCategory SubCategory
		if err := tx.First(&subCategory, *p.SubCategoryID).Error; err == nil {
			subPrefix = strings.ToUpper(strings.TrimSpace(subCategory.Sub_Category_Short_Name))
			if subPrefix == "" {
				// Fallback: Use first 3 letters of Sub_Category_Name
				cleanSubName := strings.ReplaceAll(subCategory.Sub_Category_Name, " ", "")
				if len(cleanSubName) >= 3 {
					subPrefix = strings.ToUpper(cleanSubName[:3])
				} else {
					subPrefix = "SUB"
				}
			}
		}
	}

	// 3. Fetch SubSubCategory details (if SubSubCategoryID is provided)
	subSubPrefix := ""
	if p.SubSubCategoryID != nil && *p.SubSubCategoryID > 0 {
		var subSubCategory SubSubCategory
		if err := tx.First(&subSubCategory, *p.SubSubCategoryID).Error; err == nil {
			subSubPrefix = strings.ToUpper(strings.TrimSpace(subSubCategory.Sub_Sub_Category_Short_Name))
			if subSubPrefix == "" {
				cleanSubSubName := strings.ReplaceAll(subSubCategory.Sub_Sub_Category_Name, " ", "")
				if len(cleanSubSubName) >= 3 {
					subSubPrefix = strings.ToUpper(cleanSubSubName[:3])
				} else {
					subSubPrefix = "SSUB"
				}
			}
		}
	}

	// 4. หาเลขรันถัดไปจาก "เลขสูงสุดที่เคยใช้กับ prefix นี้" ไม่ใช่จากจำนวนสินค้าในหมวดหมู่
	//
	// ของเดิมนับจำนวนแถวในชุด (category, sub_category, sub_sub_category) แล้วบวกหนึ่ง ซึ่งพังสองทาง:
	//   - คนละชุดหมวดหมู่ให้ prefix เดียวกันได้ (เช่นตอนสร้างสินค้า lookup หมวดย่อยไม่เจอ prefix
	//     ของหมวดย่อยจะว่าง) แต่ละชุดนับเลขของตัวเองแยกกันแล้วออกรหัสชนกัน — เกิดขึ้นจริงแล้วกับ
	//     ENG-00043/44/45 ที่ไปซ้ำกับสินค้าคนละตัว ทำให้การจับคู่ด้วยรหัสคืนสินค้าผิดได้
	//   - ถ้ามีสินค้าถูกลบ จำนวนแถวลดลง เลขรันถอยกลับไปทับรหัสที่เคยใช้
	//
	// การอ้างเลขสูงสุดของ prefix ตรง ๆ แก้ได้ทั้งสองกรณี และใช้ Unscoped นับรวมแถวที่ถูกลบแบบ
	// soft delete ด้วย เพื่อไม่ให้รหัสเดิมถูกนำกลับมาใช้ซ้ำ
	prefix := catPrefix + subPrefix + subSubPrefix

	// อ่านรหัสที่ใช้ไปแล้วของ prefix นี้มาหาเลขสูงสุดฝั่ง Go แทนการใช้ฟังก์ชันสตริงของฐานข้อมูล
	// เพราะไวยากรณ์ substring/regex ต่างกันระหว่าง PostgreSQL กับ SQLite ที่ชุดทดสอบใช้
	var existingCodes []string
	if err := tx.Unscoped().Model(&Product{}).
		Where("product_code LIKE ?", prefix+"-%").
		Pluck("product_code", &existingCodes).Error; err != nil {
		return err
	}

	var maxSuffix int64
	for _, code := range existingCodes {
		digits := code[strings.LastIndex(code, "-")+1:]
		n, err := strconv.ParseInt(digits, 10, 64)
		if err != nil {
			continue // รหัสรูปแบบแปลกปลอม ข้ามไปไม่ให้ทำให้เลขรันเพี้ยน
		}
		if n > maxSuffix {
			maxSuffix = n
		}
	}

	// 5. รหัสสุดท้าย — เลขถัดจากสูงสุดจึงไม่มีทางชนของเดิม
	p.Product_Code = fmt.Sprintf("%s-%05d", prefix, maxSuffix+1)

	return nil
}
