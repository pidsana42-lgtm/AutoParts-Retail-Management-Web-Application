package pos

import (
	"backend/internal/app/dto/pos"        
	posRepo "backend/internal/app/repository/pos" 
)

type POSProductService interface {
	SearchPOSProducts(search string) ([]pos.POSProductResponse, error)
}

type posProductService struct {
	repo posRepo.POSProductRepository 
}

func NewPOSProductService(repo posRepo.POSProductRepository) POSProductService {
	return &posProductService{repo: repo}
}

func (s *posProductService) SearchPOSProducts(search string) ([]pos.POSProductResponse, error) {
	products, err := s.repo.SearchProducts(search)
	if err != nil {
		return nil, err
	}

	return pos.ToPOSProductResponseList(products), nil
}