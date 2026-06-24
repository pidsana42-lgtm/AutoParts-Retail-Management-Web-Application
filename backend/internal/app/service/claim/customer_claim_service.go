package claim

import (
	"time"

	claimDTO "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"
)

type CustomerClaimService interface {
	CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error)
	CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	GetCustomerClaimByID(id uint) (claimDTO.CustomerClaimResponseDTO, error)
	ListCustomerClaims() ([]claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaim(id uint, input claimDTO.UpdateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error)
	DeleteCustomerClaim(id uint) error
}

type customerClaimService struct {
	repo claimRepo.CustomerClaimRepository
}

func NewCustomerClaimService(repo claimRepo.CustomerClaimRepository) CustomerClaimService {
	return &customerClaimService{repo: repo}
}

func (s *customerClaimService) CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error) {
	claimEntity := input.ToEntity()
	// กำหนดค่าเริ่มต้น
	claimEntity.Status = "Pending"
	claimEntity.ClaimDate = time.Now()
	// หากมีระบบ Login ให้ใช้ ID พนักงานจริง ตอนนี้กำหนด default = 1 ไปก่อน
	claimEntity.CreatedBy = 1

	// บันทึก Entity
	err := s.repo.CreateCustomerClaim(&claimEntity)
	if err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}

	return claimDTO.ToCustomerClaimResponseDTO(&claimEntity), nil
}

func (s *customerClaimService) CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error) {
	entity := input.ToEntity()
	err := s.repo.CreateCustomerClaimItem(&entity)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	return claimDTO.ToCustomerClaimItemResponseDTO(&entity), nil
}

func (s *customerClaimService) GetCustomerClaimByID(id uint) (claimDTO.CustomerClaimResponseDTO, error) {
	entity, err := s.repo.GetCustomerClaimByID(id)
	if err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}
	return claimDTO.ToCustomerClaimResponseDTO(entity), nil
}

func (s *customerClaimService) ListCustomerClaims() ([]claimDTO.CustomerClaimResponseDTO, error) {
	entities, err := s.repo.ListCustomerClaims()
	if err != nil {
		return nil, err
	}
	var res []claimDTO.CustomerClaimResponseDTO
	for _, e := range entities {
		res = append(res, claimDTO.ToCustomerClaimResponseDTO(&e))
	}
	return res, nil
}

func (s *customerClaimService) UpdateCustomerClaim(id uint, input claimDTO.UpdateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error) {
	existing, err := s.repo.GetCustomerClaimByID(id)
	if err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}
	updated := input.ToEntity(*existing)
	err = s.repo.UpdateCustomerClaim(&updated)
	if err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}
	return claimDTO.ToCustomerClaimResponseDTO(&updated), nil
}

func (s *customerClaimService) DeleteCustomerClaim(id uint) error {
	return s.repo.DeleteCustomerClaim(id)
}
