package wms

import (
	"backend/internal/app/entity"
	wmsDto "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type SubCategoryService interface {
	Create(req *wmsDto.SubCategoryRequestDTO) error
	GetByID(id uint) (*wmsDto.SubCategoryResponseDTO, error)
	List(categoryID *uint) ([]wmsDto.SubCategoryResponseDTO, error)
	Update(id uint, req *wmsDto.SubCategoryUpdateDTO) error
	Delete(id uint) error
}

type subCategoryService struct {
	repo wmsRepo.SubCategoryRepository
}

func NewSubCategoryService(repo wmsRepo.SubCategoryRepository) SubCategoryService {
	return &subCategoryService{repo: repo}
}

func (s *subCategoryService) Create(req *wmsDto.SubCategoryRequestDTO) error {
	subCat := entity.SubCategory{
		Sub_Category_Name:       req.Sub_Category_Name,
		Sub_Category_Short_Name: req.Sub_Category_Short_Name,
		Description:             req.Description,
		CategoryID:              &req.CategoryID,
	}
	return s.repo.Create(&subCat)
}

func (s *subCategoryService) GetByID(id uint) (*wmsDto.SubCategoryResponseDTO, error) {
	subCat, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toSubCategoryResponse(subCat), nil
}

func (s *subCategoryService) List(categoryID *uint) ([]wmsDto.SubCategoryResponseDTO, error) {
	list, err := s.repo.List(categoryID)
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.SubCategoryResponseDTO, len(list))
	for i, subCat := range list {
		result[i] = *toSubCategoryResponse(&subCat)
	}
	return result, nil
}

func (s *subCategoryService) Update(id uint, req *wmsDto.SubCategoryUpdateDTO) error {
	subCat, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Sub_Category_Name != "" {
		subCat.Sub_Category_Name = req.Sub_Category_Name
	}
	if req.Sub_Category_Short_Name != "" {
		subCat.Sub_Category_Short_Name = req.Sub_Category_Short_Name
	}
	if req.Description != "" {
		subCat.Description = req.Description
	}
	if req.CategoryID != nil {
		subCat.CategoryID = req.CategoryID
	}
	return s.repo.Update(subCat)
}

func toSubCategoryResponse(subCat *entity.SubCategory) *wmsDto.SubCategoryResponseDTO {
	res := &wmsDto.SubCategoryResponseDTO{
		ID:                      subCat.ID,
		Sub_Category_Name:       subCat.Sub_Category_Name,
		Sub_Category_Short_Name: subCat.Sub_Category_Short_Name,
		Description:             subCat.Description,
		CategoryID:              subCat.CategoryID,
		CreatedAt:               subCat.CreatedAt,
	}
	if subCat.Category != nil {
		res.CategoryName = subCat.Category.Category_Name
	}
	return res
}

func (s *subCategoryService) Delete(id uint) error {
	return s.repo.Delete(id)
}
