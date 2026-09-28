package claim

import (
	claimDTO "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"
)

type SupplierClaimService interface {
	CreateSupplierClaim(input claimDTO.CreateSupplierClaimDTO) (claimDTO.SupplierClaimResponseDTO, error)
	CreateSupplierClaimItem(input claimDTO.CreateSupplierClaimItemDTO) (claimDTO.SupplierClaimItemResponseDTO, error)
	GetSupplierClaimByID(id uint) (claimDTO.SupplierClaimResponseDTO, error)
	ListSupplierClaims() ([]claimDTO.SupplierClaimResponseDTO, error)
	UpdateSupplierClaim(id uint, input claimDTO.UpdateSupplierClaimDTO) (claimDTO.SupplierClaimResponseDTO, error)
	DeleteSupplierClaim(id uint) error
}

type supplierClaimService struct {
	repo claimRepo.SupplierClaimRepository
}

func NewSupplierClaimService(repo claimRepo.SupplierClaimRepository) SupplierClaimService {
	return &supplierClaimService{repo: repo}
}

func (s *supplierClaimService) CreateSupplierClaim(input claimDTO.CreateSupplierClaimDTO) (claimDTO.SupplierClaimResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreateSupplierClaim(&entity)
	if err != nil {
		return claimDTO.SupplierClaimResponseDTO{}, err
	}
	return claimDTO.ToSupplierClaimResponseDTO(&entity), nil
}

func (s *supplierClaimService) CreateSupplierClaimItem(input claimDTO.CreateSupplierClaimItemDTO) (claimDTO.SupplierClaimItemResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreateSupplierClaimItem(&entity)
	if err != nil {
		return claimDTO.SupplierClaimItemResponseDTO{}, err
	}
	return claimDTO.ToSupplierClaimItemResponseDTO(&entity), nil
}

func (s *supplierClaimService) GetSupplierClaimByID(id uint) (claimDTO.SupplierClaimResponseDTO, error) {
	entity, err := s.repo.GetSupplierClaimByID(id)
	if err != nil {
		return claimDTO.SupplierClaimResponseDTO{}, err
	}
	return claimDTO.ToSupplierClaimResponseDTO(entity), nil
}

func (s *supplierClaimService) ListSupplierClaims() ([]claimDTO.SupplierClaimResponseDTO, error) {
	entities, err := s.repo.ListSupplierClaims()
	if err != nil {
		return nil, err
	}
	res := make([]claimDTO.SupplierClaimResponseDTO, 0) // make(..., 0) กัน nil slice marshal เป็น null ตอนไม่มีเคลมซัพพลายเออร์เลย
	for _, e := range entities {
		res = append(res, claimDTO.ToSupplierClaimResponseDTO(&e))
	}
	return res, nil
}

func (s *supplierClaimService) UpdateSupplierClaim(id uint, input claimDTO.UpdateSupplierClaimDTO) (claimDTO.SupplierClaimResponseDTO, error) {
	existing, err := s.repo.GetSupplierClaimByID(id)
	if err != nil {
		return claimDTO.SupplierClaimResponseDTO{}, err
	}
	updated := input.ToEntity(*existing)
	err = s.repo.UpdateSupplierClaim(&updated)
	if err != nil {
		return claimDTO.SupplierClaimResponseDTO{}, err
	}
	return claimDTO.ToSupplierClaimResponseDTO(&updated), nil
}

func (s *supplierClaimService) DeleteSupplierClaim(id uint) error {
	return s.repo.DeleteSupplierClaim(id)
}
