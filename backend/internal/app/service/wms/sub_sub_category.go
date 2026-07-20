package wms

import (
	"backend/internal/app/entity"
	wmsDto "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type SubSubCategoryService interface {
	Create(req *wmsDto.SubSubCategoryRequestDTO) error
	GetByID(id uint) (*wmsDto.SubSubCategoryResponseDTO, error)
	List(categoryID *uint) ([]wmsDto.SubSubCategoryResponseDTO, error)
	Update(id uint, req *wmsDto.SubSubCategoryUpdateDTO) error
	Delete(id uint) error
}

type subsubCategoryService struct {
	repo wmsRepo.SubSubCategoryRepository
}

func NewSubSubCategoryService(repo wmsRepo.SubSubCategoryRepository) SubSubCategoryService {
	return &subsubCategoryService{repo: repo}
}

func (s *subsubCategoryService) Create(req *wmsDto.SubSubCategoryRequestDTO) error {
	subsubCat := entity.SubSubCategory{
		Sub_Sub_Category_Name:       req.Sub_Sub_Category_Name,
		Sub_Sub_Category_Short_Name: req.Sub_Sub_Category_Short_Name,
		Description:                 req.Description,
		SubCategoryID:               &req.SubCategoryID,
	}
	return s.repo.Create(&subsubCat)
}

func (s *subsubCategoryService) GetByID(id uint) (*wmsDto.SubSubCategoryResponseDTO, error) {
	subsubCat, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toSubSubCategoryResponse(subsubCat), nil
}

func (s *subsubCategoryService) List(SubcategoryID *uint) ([]wmsDto.SubSubCategoryResponseDTO, error) {
	list, err := s.repo.List(SubcategoryID)
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.SubSubCategoryResponseDTO, len(list))
	for i, subsubCat := range list {
		result[i] = *toSubSubCategoryResponse(&subsubCat)
	}
	return result, nil
}

func (s *subsubCategoryService) Update(id uint, req *wmsDto.SubSubCategoryUpdateDTO) error {
	subsubCat, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Sub_Sub_Category_Name != "" {
		subsubCat.Sub_Sub_Category_Name = req.Sub_Sub_Category_Name
	}
	if req.Sub_Sub_Category_Short_Name != "" {
		subsubCat.Sub_Sub_Category_Short_Name = req.Sub_Sub_Category_Short_Name
	}
	if req.Description != "" {
		subsubCat.Description = req.Description
	}
	if req.SubCategoryID != nil {
		subsubCat.SubCategoryID = req.SubCategoryID
	}
	return s.repo.Update(subsubCat)
}

func toSubSubCategoryResponse(subsubCat *entity.SubSubCategory) *wmsDto.SubSubCategoryResponseDTO {
	res := &wmsDto.SubSubCategoryResponseDTO{
		ID:                      subsubCat.ID,
		Sub_Sub_Category_Name:       subsubCat.Sub_Sub_Category_Name,
		Sub_Sub_Category_Short_Name: subsubCat.Sub_Sub_Category_Short_Name,
		Description:             subsubCat.Description,
		SubCategoryID:              subsubCat.SubCategoryID,
		CreatedAt:               subsubCat.CreatedAt,
	}
	if subsubCat.SubCategory != nil {
		res.SubCategoryName = subsubCat.SubCategory.Sub_Category_Name
	}
	return res
}

func (s *subsubCategoryService) Delete(id uint) error {
	return s.repo.Delete(id)
}