package wms

import (
	"backend/internal/app/entity"
	wmsDto "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type CategoryService interface {
	Create(req *wmsDto.CategoryRequestDTO) error
	GetByID(id uint) (*wmsDto.CategoryResponseDTO, error)
	List() ([]wmsDto.CategoryResponseDTO, error)
	Update(id uint, req *wmsDto.CategoryUpdateDTO) error
	Delete(id uint) error
}

type categoryService struct {
	repo wmsRepo.CategoryRepository
}

func NewCategoryService(repo wmsRepo.CategoryRepository) CategoryService {
	return &categoryService{repo: repo}
}

func (s *categoryService) Create(req *wmsDto.CategoryRequestDTO) error {
	cat := entity.Category{
		Category_Name:       req.Category_Name,
		Category_Short_Name: req.Category_Short_Name,
		Description:         req.Description,
	}
	return s.repo.Create(&cat)
}

func (s *categoryService) GetByID(id uint) (*wmsDto.CategoryResponseDTO, error) {
	cat, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toCategoryResponse(cat), nil
}

func (s *categoryService) List() ([]wmsDto.CategoryResponseDTO, error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.CategoryResponseDTO, len(list))
	for i, cat := range list {
		result[i] = *toCategoryResponse(&cat)
	}
	return result, nil
}

func (s *categoryService) Update(id uint, req *wmsDto.CategoryUpdateDTO) error {
	cat, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Category_Name != "" {
		cat.Category_Name = req.Category_Name
	}
	if req.Category_Short_Name != "" {
		cat.Category_Short_Name = req.Category_Short_Name
	}
	if req.Description != "" {
		cat.Description = req.Description
	}
	return s.repo.Update(cat)
}

func toCategoryResponse(cat *entity.Category) *wmsDto.CategoryResponseDTO {
	subs := make([]wmsDto.SubCategoryResponseDTO, 0, len(cat.SubCategories))
	for _, sc := range cat.SubCategories {
		subs = append(subs, wmsDto.SubCategoryResponseDTO{
			ID:                      sc.ID,
			Sub_Category_Name:       sc.Sub_Category_Name,
			Sub_Category_Short_Name: sc.Sub_Category_Short_Name,
			Description:             sc.Description,
			CategoryID:              sc.CategoryID,
			CreatedAt:               sc.CreatedAt,
		})
	}
	return &wmsDto.CategoryResponseDTO{
		ID:                  cat.ID,
		Category_Name:       cat.Category_Name,
		Category_Short_Name: cat.Category_Short_Name,
		Description:         cat.Description,
		CreatedAt:           cat.CreatedAt,
		SubCategories:       subs,
	}
}

func (s *categoryService) Delete(id uint) error {
	return s.repo.Delete(id)
}