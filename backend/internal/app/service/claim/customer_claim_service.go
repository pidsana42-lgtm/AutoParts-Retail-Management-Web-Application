package claim

import (
	"fmt"
	"strings"
	"time"

	claimDTO "backend/internal/app/dto/claim"
	claimRepo "backend/internal/app/repository/claim"
	"backend/internal/pkg/websocket"
)

type CustomerClaimService interface {
	CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error)
	CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	GetCustomerClaimByID(id uint) (claimDTO.CustomerClaimResponseDTO, error)
	ListCustomerClaims() ([]claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaim(id uint, input claimDTO.UpdateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaimItem(id uint, input claimDTO.UpdateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error)
	DeleteCustomerClaim(id uint) error
}

type customerClaimService struct {
	repo   claimRepo.CustomerClaimRepository
	soRepo claimRepo.SaleOrderLookupRepository
}

func NewCustomerClaimService(repo claimRepo.CustomerClaimRepository, soRepo claimRepo.SaleOrderLookupRepository) CustomerClaimService {
	return &customerClaimService{repo: repo, soRepo: soRepo}
}

func (s *customerClaimService) CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error) {
	claimEntity := input.ToEntity()
	claimEntity.ClaimDate = time.Now()
	claimEntity.CreatedBy = 1

	// ตั้ง ClaimNo = CLM-{order_number}
	if order, err := s.soRepo.GetSaleOrderByID(input.OriginalOrderID); err == nil {
		claimEntity.ClaimNo = "CLM-" + order.OrderNumber
	} else {
		claimEntity.ClaimNo = fmt.Sprintf("CLM-%d", input.OriginalOrderID)
	}

	// Auto-calculate amounts from items if not provided
	if input.ClaimAmount == 0 && len(input.Items) > 0 {
		var total float64
		for _, item := range input.Items {
			total += float64(item.Qty) * item.UnitPrice
		}
		claimEntity.ClaimAmount = total
	}

	if err := s.repo.CreateCustomerClaim(&claimEntity); err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}

	// สร้าง items พร้อมกันหลัง claim header ถูกสร้างแล้ว
	for _, itemInput := range input.Items {
		itemEntity := itemInput.ToEntity()
		itemEntity.CustomerClaimID = claimEntity.ID
		itemEntity.Status = claimEntity.Status // ให้สถานะของ Item ล้อตามสถานะของใบเคลม (เช่น APPROVED หรือ PENDING)
		if err := s.repo.CreateCustomerClaimItem(&itemEntity); err != nil {
			return claimDTO.CustomerClaimResponseDTO{}, err
		}
	}

	// Broadcast Notification
	msgType := "info"
	if claimEntity.Status == "PENDING" {
		msgType = "warning"
	}
	websocket.BroadcastNotification(
		"มีใบเคลมใหม่",
		fmt.Sprintf("พนักงานได้สร้างใบเคลมใหม่เลขที่ %s", claimEntity.ClaimNo),
		msgType,
	)

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

func (s *customerClaimService) syncParentClaimStatus(claimID uint) {
	if claimID == 0 {
		return
	}
	parent, err := s.repo.GetCustomerClaimByID(claimID)
	if err != nil || parent == nil || len(parent.Items) == 0 {
		return
	}

	allApproved := true
	allRejected := true
	anyApproved := false

	for _, item := range parent.Items {
		st := strings.ToUpper(strings.TrimSpace(item.Status))
		if st != "APPROVED" {
			allApproved = false
		} else {
			anyApproved = true
		}
		if st != "REJECTED" {
			allRejected = false
		}
	}

	if allApproved || anyApproved {
		parent.Status = "APPROVED"
	} else if allRejected {
		parent.Status = "REJECTED"
	} else {
		parent.Status = "PENDING"
	}

	_ = s.repo.UpdateCustomerClaim(parent)
}

func (s *customerClaimService) UpdateCustomerClaimItem(id uint, input claimDTO.UpdateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error) {
	existing, err := s.repo.GetCustomerClaimItemByID(id)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	if input.Qty > 0 {
		existing.Qty = uint(input.Qty)
	}
	if input.Reason != "" {
		existing.Reason = input.Reason
	}
	if input.Resolution != "" {
		existing.Resolution = input.Resolution
	}
	if input.ClaimType != "" {
		existing.ClaimType = input.ClaimType
	}
	if input.Status != "" {
		existing.Status = input.Status
	}
	if input.EvidenceURL != "" {
		existing.EvidenceURL = input.EvidenceURL
	}
	if err := s.repo.UpdateCustomerClaimItem(existing); err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.syncParentClaimStatus(existing.CustomerClaimID)
	return claimDTO.ToCustomerClaimItemResponseDTO(existing), nil
}

func (s *customerClaimService) UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error) {
	existing, err := s.repo.GetCustomerClaimItemByID(id)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	existing.Status = status
	if err := s.repo.UpdateCustomerClaimItem(existing); err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.syncParentClaimStatus(existing.CustomerClaimID)
	return claimDTO.ToCustomerClaimItemResponseDTO(existing), nil
}

func (s *customerClaimService) DeleteCustomerClaim(id uint) error {
	return s.repo.DeleteCustomerClaim(id)
}
