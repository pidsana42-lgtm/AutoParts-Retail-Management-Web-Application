package claim

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	claimDTO "backend/internal/app/dto/claim"
	"backend/internal/app/entity"
	claimRepo "backend/internal/app/repository/claim"
	svcNotification "backend/internal/app/service/notification"
)

type CustomerClaimService interface {
	CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO, createdBy uint) (claimDTO.CustomerClaimResponseDTO, error)
	CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	GetCustomerClaimByID(id uint) (claimDTO.CustomerClaimResponseDTO, error)
	ListCustomerClaims() ([]claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaim(id uint, input claimDTO.UpdateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaimItem(id uint, input claimDTO.UpdateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error)
	DeleteCustomerClaim(id uint) error
	GenerateCustomerClaimPDF(ctx context.Context, claimID uint) ([]byte, error)
	GenerateCustomerClaimChecklistPDF(ctx context.Context, status string, search string) ([]byte, error)
}

type customerClaimService struct {
	repo         claimRepo.CustomerClaimRepository
	soRepo       claimRepo.SaleOrderLookupRepository
	notification svcNotification.NotificationService
}

func NewCustomerClaimService(repo claimRepo.CustomerClaimRepository, soRepo claimRepo.SaleOrderLookupRepository, notificationService svcNotification.NotificationService) CustomerClaimService {
	return &customerClaimService{repo: repo, soRepo: soRepo, notification: notificationService}
}

func (s *customerClaimService) CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO, createdBy uint) (claimDTO.CustomerClaimResponseDTO, error) {
	claimEntity := input.ToEntity()
	claimEntity.ClaimDate = time.Now()
	if createdBy == 0 {
		createdBy = 1 // กันเหนียวเผื่อไม่มี user_id ใน token
	}
	claimEntity.CreatedBy = createdBy

	// ตั้ง ClaimNo = CLM-{order_number}
	var originalOrder *entity.SaleOrder
	if order, err := s.soRepo.GetSaleOrderByID(input.OriginalOrderID); err == nil {
		claimEntity.ClaimNo = "CLM-" + order.OrderNumber
		originalOrder = order
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

	// Let the repository check the entire batch under the sale-order lock
	// before writing a header, including duplicate product rows.
	for _, item := range input.Items {
		claimEntity.Items = append(claimEntity.Items, item.ToEntity())
	}
	if err := s.repo.CreateCustomerClaim(&claimEntity); err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}

	// สร้าง items พร้อมกันหลัง claim header ถูกสร้างแล้ว
	for i, itemInput := range input.Items {
		itemEntity := itemInput.ToEntity()
		itemEntity.CustomerClaimID = claimEntity.ID
		itemEntity.Status = claimEntity.Status // ให้สถานะของ Item ล้อตามสถานะของใบเคลม (เช่น APPROVED หรือ PENDING)
		issueOut, receiveIn := prepareStockFlags(&itemEntity)
		if err := s.repo.CreateCustomerClaimItem(&itemEntity); err != nil {
			return claimDTO.CustomerClaimResponseDTO{}, err
		}
		s.applyStockAdjustments(&itemEntity, issueOut, receiveIn)
		claimEntity.Items[i] = itemEntity
	}

	// แจ้งเตือนเฉพาะเจ้าของร้าน/แอดมิน (ไม่ไปโผล่หน้าพนักงานคนอื่น) — ของเดิม broadcast ทุกคน
	if s.notification != nil {
		if err := s.notification.NotifyOwners(
			"CUSTOMER_CLAIM_CREATED",
			"มีใบเคลมใหม่",
			fmt.Sprintf("พนักงานได้สร้างใบเคลมใหม่เลขที่ %s", claimEntity.ClaimNo),
			fmt.Sprintf("/owner/claims/detail/%d", claimEntity.ID),
			nil,
		); err != nil {
			fmt.Printf("[Notification] failed to notify owners (claim %d): %v\n", claimEntity.ID, err)
		}
	}

	if originalOrder != nil {
		claimEntity.OriginalOrder = originalOrder
	}

	return claimDTO.ToCustomerClaimResponseDTO(&claimEntity), nil
}

func (s *customerClaimService) CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error) {
	entity := input.ToEntity()
	issueOut, receiveIn := prepareStockFlags(&entity)
	err := s.repo.CreateCustomerClaimItem(&entity)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.applyStockAdjustments(&entity, issueOut, receiveIn)
	return claimDTO.ToCustomerClaimItemResponseDTO(&entity), nil
}

// prepareStockFlags: ตรวจว่าตอนนี้ต้อง "จ่ายสินค้าดีออกไปทดแทน" (StockOutIssued) หรือ
// "รับสินค้าทดแทนจากซัพพลายเออร์เข้าคลัง" (StockInReceived) หรือยัง โดยดูจาก:
//   - จ่ายออก: ประเภทเคลม SUPPLIER_PENDING (ให้ของสำรองไปก่อนระหว่างรอส่งของเสียไปเคลม) หรือ
//     INSTANT ที่สถานะเป็น APPROVED (หยิบของดีให้ลูกค้าทันทีตอนอนุมัติ)
//   - รับเข้า: resolution ถูกตั้งเป็น REPLACEMENT_RECEIVED (พนักงานกดยืนยันว่าได้รับของเปลี่ยนจากซัพพลายเออร์แล้ว)
//
// ถ้าเข้าเงื่อนไขและ "ยังไม่เคยทำมาก่อน" (เช็คจาก flag เดิมของ item) จะ set flag เป็น true ทันที (ให้ถูกบันทึก
// ไปพร้อมกับการ Save/Create ครั้งนี้เลย) และคืนค่ากลับมาว่าต้องปรับสต็อกจริงหลัง save สำเร็จหรือไม่ — ป้องกันการ
// ตัด/เติมสต็อกซ้ำเวลามีคนสลับสถานะไปมา (เช่น อนุมัติ -> ปฏิเสธ -> อนุมัติใหม่) เพราะของจริงจ่าย/รับแค่ครั้งเดียว
func prepareStockFlags(item *entity.CustomerClaimItem) (issueOut, receiveIn bool) {
	if item.ProductID == 0 || item.Qty == 0 {
		return false, false
	}
	claimTypeUp := strings.ToUpper(strings.TrimSpace(item.ClaimType))
	statusUp := strings.ToUpper(strings.TrimSpace(item.Status))
	resolutionUp := strings.ToUpper(strings.TrimSpace(item.Resolution))

	if !item.StockOutIssued && (claimTypeUp == "SUPPLIER_PENDING" || (claimTypeUp == "INSTANT" && statusUp == "APPROVED")) {
		item.StockOutIssued = true
		issueOut = true
	}
	if !item.StockInReceived && resolutionUp == "REPLACEMENT_RECEIVED" {
		item.StockInReceived = true
		receiveIn = true
	}
	return issueOut, receiveIn
}

func (s *customerClaimService) applyStockAdjustments(item *entity.CustomerClaimItem, issueOut, receiveIn bool) {
	if issueOut {
		s.adjustProductStock(item.ProductID, -int(item.Qty), "CLAIM_OUT",
			fmt.Sprintf("จ่ายสินค้าทดแทนให้ลูกค้า (รายการเคลม #%d)", item.ID))
	}
	if receiveIn {
		s.adjustProductStock(item.ProductID, int(item.Qty), "CLAIM_IN",
			fmt.Sprintf("รับสินค้าทดแทนจากซัพพลายเออร์ (รายการเคลม #%d)", item.ID))
	}
}

func (s *customerClaimService) adjustProductStock(productID uint, delta int, movementType, note string) {
	if err := s.repo.AdjustProductStock(productID, delta, movementType, note); err != nil {
		fmt.Printf("[Stock] failed to adjust product %d stock (%s): %v\n", productID, movementType, err)
	}
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
	previousStatus := parent.Status

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

	// แจ้งเตือนเฉพาะพนักงานที่สร้างใบเคลมนี้ (ไม่ไปโผล่หน้าคนอื่น) — แจ้งครั้งเดียวตอนสถานะเพิ่งเปลี่ยนเป็นอนุมัติ/ตีกลับจริงๆ
	if s.notification != nil && parent.Status != previousStatus && (parent.Status == "APPROVED" || parent.Status == "REJECTED") && parent.CreatedBy != 0 {
		title := "ใบเคลมได้รับการอนุมัติแล้ว"
		message := fmt.Sprintf("ใบเคลมเลขที่ %s ได้รับการอนุมัติแล้ว", parent.ClaimNo)
		notifType := "CUSTOMER_CLAIM_APPROVED"
		if parent.Status == "REJECTED" {
			title = "ใบเคลมถูกปฏิเสธ"
			message = fmt.Sprintf("ใบเคลมเลขที่ %s ถูกปฏิเสธ", parent.ClaimNo)
			notifType = "CUSTOMER_CLAIM_REJECTED"
		}
		if err := s.notification.NotifyUser(
			parent.CreatedBy,
			notifType,
			title,
			message,
			fmt.Sprintf("/employee/claims/detail/%d", parent.ID),
			nil,
		); err != nil {
			fmt.Printf("[Notification] failed to notify user %d (claim %d): %v\n", parent.CreatedBy, parent.ID, err)
		}
	}
}

func (s *customerClaimService) UpdateCustomerClaimItem(id uint, input claimDTO.UpdateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error) {
	existing, err := s.repo.GetCustomerClaimItemByID(id)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	if existing.Resolution == "COMPLETED" || strings.Contains(existing.Resolution, "ส่งมอบ") || strings.Contains(existing.Resolution, "สำเร็จ") {
		return claimDTO.CustomerClaimItemResponseDTO{}, errors.New("รายการเคลมนี้ถูกส่งมอบลูกค้าแล้ว ไม่สามารถแก้ไขได้อีก")
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
	issueOut, receiveIn := prepareStockFlags(existing)
	if err := s.repo.UpdateCustomerClaimItem(existing); err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.applyStockAdjustments(existing, issueOut, receiveIn)
	s.syncParentClaimStatus(existing.CustomerClaimID)
	return claimDTO.ToCustomerClaimItemResponseDTO(existing), nil
}

func (s *customerClaimService) UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error) {
	existing, err := s.repo.GetCustomerClaimItemByID(id)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	if existing.Resolution == "COMPLETED" || strings.Contains(existing.Resolution, "ส่งมอบ") || strings.Contains(existing.Resolution, "สำเร็จ") {
		return claimDTO.CustomerClaimItemResponseDTO{}, errors.New("รายการเคลมนี้ถูกส่งมอบลูกค้าแล้ว ไม่สามารถแก้ไขได้อีก")
	}
	existing.Status = status
	issueOut, receiveIn := prepareStockFlags(existing)
	if err := s.repo.UpdateCustomerClaimItem(existing); err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.applyStockAdjustments(existing, issueOut, receiveIn)
	s.syncParentClaimStatus(existing.CustomerClaimID)
	return claimDTO.ToCustomerClaimItemResponseDTO(existing), nil
}

func (s *customerClaimService) DeleteCustomerClaim(id uint) error {
	return s.repo.DeleteCustomerClaim(id)
}
