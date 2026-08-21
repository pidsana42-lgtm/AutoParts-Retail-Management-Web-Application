package entity

import "gorm.io/gorm"

type Catalog struct {
	gorm.Model
	CatalogCode  string        `gorm:"type:varchar(50);not null;unique" json:"catalog_code"`
	CatalogName  string        `gorm:"type:varchar(200);not null" json:"catalog_name"`
	Brand        string        `gorm:"type:varchar(100);not null" json:"brand"`
	Category     string        `gorm:"type:varchar(100)" json:"category"`
	SupplierID   uint          `gorm:"not null;index" json:"supplier_id"`
	Supplier     *Supplier     `gorm:"foreignKey:SupplierID" json:"supplier,omitempty"`
	Description  string        `gorm:"type:text" json:"description"`
	CoverImage   string        `gorm:"type:text" json:"cover_image"`
	CatalogFile  string        `gorm:"type:text" json:"catalog_file"`
	IsActive     bool          `gorm:"default:true" json:"is_active"`
	CatalogItems []CatalogItem `gorm:"foreignKey:CatalogID;constraint:OnDelete:CASCADE;" json:"catalog_items,omitempty"`
}

type CatalogItem struct {
	gorm.Model
	CatalogID      uint     `gorm:"not null;index" json:"catalog_id"`
	Catalog        *Catalog `gorm:"foreignKey:CatalogID" json:"catalog,omitempty"`
	PartNumber     string   `gorm:"type:varchar(100);not null;index" json:"part_number"`
	PartName       string   `gorm:"type:varchar(200);not null" json:"part_name"`
	Brand          string   `gorm:"type:varchar(100)" json:"brand"`
	CompatibleCars string   `gorm:"type:varchar(255)" json:"compatible_cars"`
	StandardPrice  float64  `gorm:"type:decimal(15,2);default:0.00" json:"standard_price"`
	Unit           string   `gorm:"type:varchar(50);default:'ชิ้น'" json:"unit"`
	Image          string   `gorm:"type:text" json:"image"`
	Remark         string   `gorm:"type:text" json:"remark"`
}

