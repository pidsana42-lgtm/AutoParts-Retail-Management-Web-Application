package entity

import (
	"gorm.io/gorm"
	"time"
)

type Product struct {
	gorm.Model
	Product_Code string  `json:"product_code"`
	Part_Number   string  `json:"part_number"`
	Product_Name  string  `json:"product_name"`
	Barcode       string  `json:"barcode"`
	Quantity	 int     `json:"quantity"`
	Limit_Quantity  int     `json:"limit_quantity"`
	Sale_price      float64 `json:"sale_price"`
	Cost_price      float64 `json:"cost_price"`
	Is_Active      bool    `json:"is_active"`
	Import_DateTime time.Time `json:"import_datetime"`
	Note		   string  `json:"note"`

	BrandID uint `json:"brand_id"`
	UnitID uint `json:"unit_id"`
	CategoryID uint `json:"category_id"`
	GradeID uint `json:"grade_id"`
	ShelfID uint `json:"shelf_id"`

	Brand *Brand `gorm:"foreignKey:BrandID" json:"brand"`
	Unit  *Unit  `gorm:"foreignKey:UnitID" json:"unit"`
	Category *Category `gorm:"foreignKey:CategoryID" json:"category"`
	Grade *Grade `gorm:"foreignKey:GradeID" json:"grade"`
	Shelf *Shelf `gorm:"foreignKey:ShelfID" json:"shelf"`

	StockAlerts []StockAlert `gorm:"foreignKey:ProductID" json:"stock_alerts"`
	Inventories []Inventory `gorm:"foreignKey:ProductID" json:"inventories"`
	CheckStocks []CheckStock `gorm:"foreignKey:ProductID" json:"check_stocks"`
	BillItems []BillItem `gorm:"foreignKey:ProductID" json:"bill_items"`
}