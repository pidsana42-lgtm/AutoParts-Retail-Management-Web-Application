package pre_order

import (
	preOrderDTO "backend/internal/app/dto/pre_oder"
	preOrderRepo "backend/internal/app/repository/pre_oder"
)

type PreOrderService interface {
	CreatePreOrder(input preOrderDTO.CreatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error)
	CreatePreOrderItem(input preOrderDTO.CreatePreOrderItemDTO) (preOrderDTO.PreOrderItemResponseDTO, error)
	GetPreOrderByID(id uint) (preOrderDTO.PreOrderResponseDTO, error)
	ListPreOrders() ([]preOrderDTO.PreOrderResponseDTO, error)
	UpdatePreOrder(id uint, input preOrderDTO.UpdatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error)
	DeletePreOrder(id uint) error
}

type preOrderService struct {
	repo preOrderRepo.PreOrderRepository
}

func NewPreOrderService(repo preOrderRepo.PreOrderRepository) PreOrderService {
	return &preOrderService{repo: repo}
}

func (s *preOrderService) CreatePreOrder(input preOrderDTO.CreatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreatePreOrder(&entity)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}
	return preOrderDTO.ToPreOrderResponseDTO(&entity), nil
}

func (s *preOrderService) CreatePreOrderItem(input preOrderDTO.CreatePreOrderItemDTO) (preOrderDTO.PreOrderItemResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreatePreOrderItem(&entity)
	if err != nil {
		return preOrderDTO.PreOrderItemResponseDTO{}, err
	}
	return preOrderDTO.ToPreOrderItemResponseDTO(&entity), nil
}

func (s *preOrderService) GetPreOrderByID(id uint) (preOrderDTO.PreOrderResponseDTO, error) {
	entity, err := s.repo.GetPreOrderByID(id)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}
	return preOrderDTO.ToPreOrderResponseDTO(entity), nil
}

func (s *preOrderService) ListPreOrders() ([]preOrderDTO.PreOrderResponseDTO, error) {
	entities, err := s.repo.ListPreOrders()
	if err != nil {
		return nil, err
	}
	res := make([]preOrderDTO.PreOrderResponseDTO, len(entities))
	for i := range entities {
		res[i] = preOrderDTO.ToPreOrderResponseDTO(&entities[i])
	}
	return res, nil
}

func (s *preOrderService) UpdatePreOrder(id uint, input preOrderDTO.UpdatePreOrderDTO) (preOrderDTO.PreOrderResponseDTO, error) {
	existing, err := s.repo.GetPreOrderByID(id)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}
	updated := input.ToEntity(*existing)
	err = s.repo.UpdatePreOrder(&updated)
	if err != nil {
		return preOrderDTO.PreOrderResponseDTO{}, err
	}
	return preOrderDTO.ToPreOrderResponseDTO(&updated), nil
}

func (s *preOrderService) DeletePreOrder(id uint) error {
	return s.repo.DeletePreOrder(id)
}
