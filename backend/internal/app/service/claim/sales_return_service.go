package claim

import (
	claimDTO "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"
)

type SalesReturnService interface {
	CreateSalesReturn(input claimDTO.CreateSalesReturnDTO) (claimDTO.SalesReturnResponseDTO, error)
	CreateSalesReturnItem(input claimDTO.CreateSalesReturnItemDTO) (claimDTO.SalesReturnItemResponseDTO, error)
	GetSalesReturnByID(id uint) (claimDTO.SalesReturnResponseDTO, error)
	ListSalesReturns() ([]claimDTO.SalesReturnResponseDTO, error)
	UpdateSalesReturn(id uint, input claimDTO.UpdateSalesReturnDTO) (claimDTO.SalesReturnResponseDTO, error)
	DeleteSalesReturn(id uint) error
}

type salesReturnService struct {
	repo claimRepo.SalesReturnRepository
}

func NewSalesReturnService(repo claimRepo.SalesReturnRepository) SalesReturnService {
	return &salesReturnService{repo: repo}
}

func (s *salesReturnService) CreateSalesReturn(input claimDTO.CreateSalesReturnDTO) (claimDTO.SalesReturnResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreateSalesReturn(&entity)
	if err != nil {
		return claimDTO.SalesReturnResponseDTO{}, err
	}
	return claimDTO.ToSalesReturnResponseDTO(&entity), nil
}

func (s *salesReturnService) CreateSalesReturnItem(input claimDTO.CreateSalesReturnItemDTO) (claimDTO.SalesReturnItemResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreateSalesReturnItem(&entity)
	if err != nil {
		return claimDTO.SalesReturnItemResponseDTO{}, err
	}
	return claimDTO.ToSalesReturnItemResponseDTO(&entity), nil
}

func (s *salesReturnService) GetSalesReturnByID(id uint) (claimDTO.SalesReturnResponseDTO, error) {
	entity, err := s.repo.GetSalesReturnByID(id)
	if err != nil {
		return claimDTO.SalesReturnResponseDTO{}, err
	}
	return claimDTO.ToSalesReturnResponseDTO(entity), nil
}

func (s *salesReturnService) ListSalesReturns() ([]claimDTO.SalesReturnResponseDTO, error) {
	entities, err := s.repo.ListSalesReturns()
	if err != nil {
		return nil, err
	}
	var res []claimDTO.SalesReturnResponseDTO
	for _, e := range entities {
		res = append(res, claimDTO.ToSalesReturnResponseDTO(&e))
	}
	return res, nil
}

func (s *salesReturnService) UpdateSalesReturn(id uint, input claimDTO.UpdateSalesReturnDTO) (claimDTO.SalesReturnResponseDTO, error) {
	existing, err := s.repo.GetSalesReturnByID(id)
	if err != nil {
		return claimDTO.SalesReturnResponseDTO{}, err
	}
	updated := input.ToEntity(*existing)
	err = s.repo.UpdateSalesReturn(&updated)
	if err != nil {
		return claimDTO.SalesReturnResponseDTO{}, err
	}
	return claimDTO.ToSalesReturnResponseDTO(&updated), nil
}

func (s *salesReturnService) DeleteSalesReturn(id uint) error {
	return s.repo.DeleteSalesReturn(id)
}
