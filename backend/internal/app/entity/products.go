package entity

import (
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type Product struct {
	gorm.Model
	Product_Code    string    `json:"product_code"`
	Part_Number     string    `json:"part_number"`
	Product_Name    string    `json:"product_name"`
	Barcode         string    `json:"barcode"`
	Quantity        int       `json:"quantity"`
	Limit_Quantity  int       `json:"limit_quantity"`
	Sale_price      float64   `json:"sale_price"`
	Cost_price      float64   `json:"cost_price"`
	Is_Active       bool      `json:"is_active"`
	Import_DateTime time.Time `json:"import_datetime"`
	Note            string    `json:"note"`

	UnitID             uint   `json:"unit_id"`
	CategoryID         uint   `json:"category_id"`
	SubCategoryID      *uint  `json:"sub_category_id" gorm:"default:null"`
	SubSubCategoryID   *uint  `json:"sub_sub_category_id" gorm:"default:null"`
	GradeID            uint   `json:"grade_id"`
	ShelfID            uint   `json:"shelf_id"`
	ShelfLevelID       *uint  `json:"shelf_level_id" gorm:"default:null"`
	CompanyProductCode string `json:"company_product_code"`

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
	if p.Product_Code != "" {
		if p.Barcode == "" {
			p.Barcode = p.Product_Code
		}
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

	// 4. Count products in the same category & subcategory to get the sequential index
	var count int64
	query := tx.Model(&Product{}).Where("category_id = ?", p.CategoryID)
	if p.SubCategoryID != nil && *p.SubCategoryID > 0 {
		query = query.Where("sub_category_id = ?", *p.SubCategoryID)
	} else {
		query = query.Where("sub_category_id IS NULL OR sub_category_id = 0")
	}
	if p.SubSubCategoryID != nil && *p.SubSubCategoryID > 0 {
		query = query.Where("sub_sub_category_id = ?", *p.SubSubCategoryID)
	} else {
		query = query.Where("sub_sub_category_id IS NULL OR sub_sub_category_id = 0")
	}

	if err := query.Count(&count).Error; err != nil {
		return err
	}

	// Next sequential running number
	runningNumber := count + 1

	// 5. Combine into final product code
	p.Product_Code = fmt.Sprintf("%s%s%s-%05d", catPrefix, subPrefix, subSubPrefix, runningNumber)

	// 6. Fallback barcode to product code if empty
	if p.Barcode == "" {
		p.Barcode = p.Product_Code
	}

	return nil
}
