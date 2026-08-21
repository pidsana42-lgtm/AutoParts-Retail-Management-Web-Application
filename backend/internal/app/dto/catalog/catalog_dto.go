package catalog

import (
	"time"
	"backend/internal/app/entity"
)

type CreateCatalogItemDTO struct {
	PartNumber     string  `json:"part_number" binding:"required"`
	PartName       string  `json:"part_name" binding:"required"`
	Brand          string  `json:"brand"`
	CompatibleCars string  `json:"compatible_cars"`
	StandardPrice  float64 `json:"standard_price"`
	Unit           string  `json:"unit"`
	Image          string  `json:"image"`
	Remark         string  `json:"remark"`
}

type CreateCatalogDTO struct {
	CatalogCode  string                 `json:"catalog_code" binding:"required"`
	CatalogName  string                 `json:"catalog_name" binding:"required"`
	Brand        string                 `json:"brand" binding:"required"`
	Category     string                 `json:"category"`
	SupplierID   uint                   `json:"supplier_id"`
	Description  string                 `json:"description"`
	CoverImage   string                 `json:"cover_image"`
	CatalogFile  string                 `json:"catalog_file"`
	IsActive     bool                   `json:"is_active"`
	CatalogItems []CreateCatalogItemDTO `json:"catalog_items"`
}

type UpdateCatalogDTO struct {
	CatalogCode  *string                 `json:"catalog_code,omitempty"`
	CatalogName  *string                 `json:"catalog_name,omitempty"`
	Brand        *string                 `json:"brand,omitempty"`
	Category     *string                 `json:"category,omitempty"`
	SupplierID   *uint                   `json:"supplier_id,omitempty"`
	Description  *string                 `json:"description,omitempty"`
	CoverImage   *string                 `json:"cover_image,omitempty"`
	CatalogFile  *string                 `json:"catalog_file,omitempty"`
	IsActive     *bool                   `json:"is_active,omitempty"`
	CatalogItems *[]CreateCatalogItemDTO `json:"catalog_items,omitempty"`
}

type CatalogItemResponseDTO struct {
	ID             uint      `json:"id"`
	CatalogID      uint      `json:"catalog_id"`
	PartNumber     string    `json:"part_number"`
	PartName       string    `json:"part_name"`
	Brand          string    `json:"brand"`
	CompatibleCars string    `json:"compatible_cars"`
	StandardPrice  float64   `json:"standard_price"`
	Unit           string    `json:"unit"`
	Image          string    `json:"image"`
	Remark         string    `json:"remark"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

type CatalogResponseDTO struct {
	ID           uint                     `json:"id"`
	CatalogCode  string                   `json:"catalog_code"`
	CatalogName  string                   `json:"catalog_name"`
	Brand        string                   `json:"brand"`
	Category     string                   `json:"category"`
	SupplierID   uint                     `json:"supplier_id"`
	SupplierName string                   `json:"supplier_name,omitempty"`
	Description  string                   `json:"description"`
	CoverImage   string                   `json:"cover_image"`
	CatalogFile  string                   `json:"catalog_file"`
	IsActive     bool                     `json:"is_active"`
	ItemCount    int                      `json:"item_count"`
	CatalogItems []CatalogItemResponseDTO `json:"catalog_items"`
	CreatedAt    time.Time                `json:"created_at"`
	UpdatedAt    time.Time                `json:"updated_at"`
}

func ToCatalogItemResponseDTO(m *entity.CatalogItem) CatalogItemResponseDTO {
	return CatalogItemResponseDTO{
		ID:             m.ID,
		CatalogID:      m.CatalogID,
		PartNumber:     m.PartNumber,
		PartName:       m.PartName,
		Brand:          m.Brand,
		CompatibleCars: m.CompatibleCars,
		StandardPrice:  m.StandardPrice,
		Unit:           m.Unit,
		Image:          m.Image,
		Remark:         m.Remark,
		CreatedAt:      m.CreatedAt,
		UpdatedAt:      m.UpdatedAt,
	}
}

func ToCatalogResponseDTO(m *entity.Catalog) CatalogResponseDTO {
	var items []CatalogItemResponseDTO
	for _, it := range m.CatalogItems {
		items = append(items, ToCatalogItemResponseDTO(&it))
	}

	suppName := ""
	if m.Supplier != nil {
		suppName = m.Supplier.SupplierName
	}

	return CatalogResponseDTO{
		ID:           m.ID,
		CatalogCode:  m.CatalogCode,
		CatalogName:  m.CatalogName,
		Brand:        m.Brand,
		Category:     m.Category,
		SupplierID:   m.SupplierID,
		SupplierName: suppName,
		Description:  m.Description,
		CoverImage:   m.CoverImage,
		CatalogFile:  m.CatalogFile,
		IsActive:     m.IsActive,
		ItemCount:    len(m.CatalogItems),
		CatalogItems: items,
		CreatedAt:    m.CreatedAt,
		UpdatedAt:    m.UpdatedAt,
	}
}
