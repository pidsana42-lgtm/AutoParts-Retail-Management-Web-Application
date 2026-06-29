package wms

import (
	wmsDto  "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type ProductService interface {
	CreateProduct(req *wmsDto.ProductRequestDTO) error
	GetProductByID(id uint) (*wmsDto.ProductListResponseDTO, error)
	UpdateProduct(id uint, req *wmsDto.ProductRequestDTO) error
	DeleteProduct(id uint) error
	ListProducts() ([]wmsDto.ProductListResponseDTO, error)
}

type productService struct {
	repo wmsRepo.ProductRepository
}

func NewProductService(repo wmsRepo.ProductRepository) ProductService {
	return &productService{repo: repo}
}

func (s *productService) CreateProduct(req *wmsDto.ProductRequestDTO) error {
	product := req.ToEntity()
	return s.repo.CreateProduct(&product)
}

func (s *productService) GetProductByID(id uint) (*wmsDto.ProductListResponseDTO, error) {
	product, err := s.repo.GetProductByID(id)
	if err != nil {
		return nil, err
	}
	var dto wmsDto.ProductListResponseDTO
	dto.FromEntity(*product)
	return &dto, nil
}

func (s *productService) UpdateProduct(id uint, req *wmsDto.ProductRequestDTO) error {
	product := req.ToEntity()
	product.ID = id
	return s.repo.UpdateProduct(&product)
}

func (s *productService) DeleteProduct(id uint) error {
	return s.repo.DeleteProduct(id)
}

func (s *productService) ListProducts() ([]wmsDto.ProductListResponseDTO, error) {
	products, err := s.repo.ListProducts()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.ProductListResponseDTO, len(products))
	for i, p := range products {
		result[i].FromEntity(p)
	}
	return result, nil
}
