package catalog

import (
	"errors"
	dto "backend/internal/app/dto/catalog"
	"backend/internal/app/entity"
	repo "backend/internal/app/repository/catalog"
)

type CatalogService interface {
	CreateCatalog(d dto.CreateCatalogDTO) (*dto.CatalogResponseDTO, error)
	GetCatalogByID(id uint) (*dto.CatalogResponseDTO, error)
	ListCatalogs(search string, brand string, category string) ([]dto.CatalogResponseDTO, error)
	UpdateCatalog(id uint, d dto.UpdateCatalogDTO) (*dto.CatalogResponseDTO, error)
	DeleteCatalog(id uint) error
	SearchCatalogItems(search string, brand string) ([]dto.CatalogItemResponseDTO, error)
}

type catalogService struct {
	repo repo.CatalogRepository
}

func NewCatalogService(r repo.CatalogRepository) CatalogService {
	// Auto seed demo catalogs on startup if empty
	_ = r.SeedDefaultCatalogsIfEmpty()
	return &catalogService{repo: r}
}

func (s *catalogService) CreateCatalog(d dto.CreateCatalogDTO) (*dto.CatalogResponseDTO, error) {
	var items []entity.CatalogItem
	for _, it := range d.CatalogItems {
		items = append(items, entity.CatalogItem{
			PartNumber:     it.PartNumber,
			PartName:       it.PartName,
			Brand:          it.Brand,
			CompatibleCars: it.CompatibleCars,
			StandardPrice:  it.StandardPrice,
			Unit:           it.Unit,
			Image:          it.Image,
			Remark:         it.Remark,
		})
	}

	suppID := d.SupplierID
	if suppID == 0 {
		suppID = 1
	}

	cat := entity.Catalog{
		CatalogCode:  d.CatalogCode,
		CatalogName:  d.CatalogName,
		Brand:        d.Brand,
		Category:     d.Category,
		SupplierID:   suppID,
		Description:  d.Description,
		CoverImage:   d.CoverImage,
		CatalogFile:  d.CatalogFile,
		IsActive:     d.IsActive,
		CatalogItems: items,
	}

	if err := s.repo.CreateCatalog(&cat); err != nil {
		return nil, err
	}

	res := dto.ToCatalogResponseDTO(&cat)
	return &res, nil
}

func (s *catalogService) GetCatalogByID(id uint) (*dto.CatalogResponseDTO, error) {
	cat, err := s.repo.GetCatalogByID(id)
	if err != nil {
		return nil, err
	}
	res := dto.ToCatalogResponseDTO(cat)
	return &res, nil
}

func (s *catalogService) ListCatalogs(search string, brand string, category string) ([]dto.CatalogResponseDTO, error) {
	cats, err := s.repo.ListCatalogs(search, brand, category)
	if err != nil {
		return nil, err
	}

	res := make([]dto.CatalogResponseDTO, 0) // make(..., 0) กัน nil slice marshal เป็น null ตอนไม่มีแคตตาล็อกเลย
	for _, c := range cats {
		res = append(res, dto.ToCatalogResponseDTO(&c))
	}
	return res, nil
}

func (s *catalogService) UpdateCatalog(id uint, d dto.UpdateCatalogDTO) (*dto.CatalogResponseDTO, error) {
	cat, err := s.repo.GetCatalogByID(id)
	if err != nil {
		return nil, errors.New("catalog not found")
	}

	if d.CatalogCode != nil {
		cat.CatalogCode = *d.CatalogCode
	}
	if d.CatalogName != nil {
		cat.CatalogName = *d.CatalogName
	}
	if d.Brand != nil {
		cat.Brand = *d.Brand
	}
	if d.Category != nil {
		cat.Category = *d.Category
	}
	if d.SupplierID != nil {
		cat.SupplierID = *d.SupplierID
	}
	if d.Description != nil {
		cat.Description = *d.Description
	}
	if d.CoverImage != nil {
		cat.CoverImage = *d.CoverImage
	}
	if d.CatalogFile != nil {
		cat.CatalogFile = *d.CatalogFile
	}
	if d.IsActive != nil {
		cat.IsActive = *d.IsActive
	}
	if d.CatalogItems != nil {
		var items []entity.CatalogItem
		for _, it := range *d.CatalogItems {
			items = append(items, entity.CatalogItem{
				CatalogID:      id,
				PartNumber:     it.PartNumber,
				PartName:       it.PartName,
				Brand:          it.Brand,
				CompatibleCars: it.CompatibleCars,
				StandardPrice:  it.StandardPrice,
				Unit:           it.Unit,
				Image:          it.Image,
				Remark:         it.Remark,
			})
		}
		cat.CatalogItems = items
	}

	if err := s.repo.UpdateCatalog(cat); err != nil {
		return nil, err
	}

	res := dto.ToCatalogResponseDTO(cat)
	return &res, nil
}

func (s *catalogService) DeleteCatalog(id uint) error {
	return s.repo.DeleteCatalog(id)
}

func (s *catalogService) SearchCatalogItems(search string, brand string) ([]dto.CatalogItemResponseDTO, error) {
	items, err := s.repo.SearchCatalogItems(search, brand)
	if err != nil {
		return nil, err
	}
	res := make([]dto.CatalogItemResponseDTO, 0) // make(..., 0) กัน nil slice marshal เป็น null ตอนค้นหาไม่เจอเลย
	for _, it := range items {
		res = append(res, dto.ToCatalogItemResponseDTO(&it))
	}
	return res, nil
}
