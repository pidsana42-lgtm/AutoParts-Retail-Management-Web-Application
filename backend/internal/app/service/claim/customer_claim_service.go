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

// ErrClaimItemAlreadyDelivered: รายการเคลมที่ส่งมอบลูกค้าไปแล้วห้ามแก้ไข/เปลี่ยนสถานะซ้ำอีก
// (ควรตอบกลับเป็น 409 Conflict ไม่ใช่ 500 เพราะไม่ใช่ error ของระบบ แต่เป็นกฎธุรกิจที่ทำงานถูกต้อง)
var ErrClaimItemAlreadyDelivered = errors.New("รายการเคลมนี้ถูกส่งมอบลูกค้าแล้ว ไม่สามารถแก้ไขได้อีก")

type CustomerClaimService interface {
	CreateCustomerClaim(input claimDTO.CreateCustomerClaimDTO, createdBy uint) (claimDTO.CustomerClaimResponseDTO, error)
	CreateCustomerClaimItem(input claimDTO.CreateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	GetCustomerClaimByID(id uint) (claimDTO.CustomerClaimResponseDTO, error)
	ListCustomerClaims() ([]claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaim(id uint, input claimDTO.UpdateCustomerClaimDTO) (claimDTO.CustomerClaimResponseDTO, error)
	UpdateCustomerClaimItem(id uint, input claimDTO.UpdateCustomerClaimItemDTO) (claimDTO.CustomerClaimItemResponseDTO, error)
	UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error)
	DeleteCustomerClaim(id uint) error
	CancelCustomerClaim(id uint) (claimDTO.CustomerClaimResponseDTO, error)
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
		issueOut, receiveIn, reverseOut := prepareStockFlags(&itemEntity)
		applyCredit, reverseCredit := prepareCreditFlag(&itemEntity)
		if err := s.repo.CreateCustomerClaimItem(&itemEntity); err != nil {
			return claimDTO.CustomerClaimResponseDTO{}, err
		}
		s.applyStockAdjustments(&itemEntity, issueOut, receiveIn, reverseOut, itemEntity.Qty)
		s.applyCreditAdjustment(&itemEntity, applyCredit, reverseCredit, float64(itemEntity.Qty)*itemEntity.UnitPrice)
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
	issueOut, receiveIn, reverseOut := prepareStockFlags(&entity)
	applyCredit, reverseCredit := prepareCreditFlag(&entity)
	err := s.repo.CreateCustomerClaimItem(&entity)
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.applyStockAdjustments(&entity, issueOut, receiveIn, reverseOut, entity.Qty)
	s.applyCreditAdjustment(&entity, applyCredit, reverseCredit, float64(entity.Qty)*entity.UnitPrice)
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
//
// reverseOut: ต้องคืนสต็อกที่เคยจ่ายออกไปแล้ว (StockOutIssued=true) กลับเข้าคลังทันที เพราะไม่มีการอนุมัติ
// จริงเหลืออยู่แล้ว มี 2 กรณี:
//   - INSTANT: สถานะถูกเปลี่ยนออกจาก APPROVED (เช่น เจ้าของกดอนุมัติแล้วกดตีกลับทีหลัง)
//   - SUPPLIER_PENDING: ของถูกจ่ายออกไปตั้งแต่ก่อนอนุมัติ (ระหว่างรอบริษัทตรวจ) แต่สุดท้ายผลออกมาเป็น REJECTED
//     ต้องคืนสต็อกกลับเช่นกัน ไม่งั้นสต็อกจะหายไปฟรีทั้งที่เคลมนี้ถูกปฏิเสธไปแล้ว
func prepareStockFlags(item *entity.CustomerClaimItem) (issueOut, receiveIn, reverseOut bool) {
	if item.ProductID == 0 || item.Qty == 0 {
		return false, false, false
	}
	claimTypeUp := strings.ToUpper(strings.TrimSpace(item.ClaimType))
	statusUp := strings.ToUpper(strings.TrimSpace(item.Status))
	resolutionUp := strings.ToUpper(strings.TrimSpace(item.Resolution))

	shouldIssueOut := claimTypeUp == "SUPPLIER_PENDING" || (claimTypeUp == "INSTANT" && statusUp == "APPROVED")
	shouldReverseOut := (claimTypeUp == "INSTANT" && statusUp != "APPROVED") || (claimTypeUp == "SUPPLIER_PENDING" && statusUp == "REJECTED")

	if !item.StockOutIssued && shouldIssueOut {
		item.StockOutIssued = true
		issueOut = true
	} else if item.StockOutIssued && shouldReverseOut {
		item.StockOutIssued = false
		reverseOut = true
	}
	if !item.StockInReceived && resolutionUp == "REPLACEMENT_RECEIVED" {
		item.StockInReceived = true
		receiveIn = true
	}
	return issueOut, receiveIn, reverseOut
}

// applyStockAdjustments: reverseQty คือจำนวนที่ต้อง "คืน" กลับเข้าคลัง ระบุแยกจาก item.Qty เพราะถ้าจำนวนใน
// ใบเคลมถูกแก้ไขในคำขอเดียวกับที่ทำให้เกิดการ reverse (เช่น แก้จำนวน+เปลี่ยนสถานะพร้อมกัน) ต้องคืนตามจำนวนที่
// "เคยตัดออกไปจริง" (จำนวนเดิมก่อนแก้ไข) ไม่ใช่จำนวนใหม่ล่าสุดในฟอร์ม
func (s *customerClaimService) applyStockAdjustments(item *entity.CustomerClaimItem, issueOut, receiveIn, reverseOut bool, reverseQty uint) {
	if issueOut {
		s.adjustProductStock(item.ProductID, -int(item.Qty), "CLAIM_OUT",
			fmt.Sprintf("จ่ายสินค้าทดแทนให้ลูกค้า (รายการเคลม #%d)", item.ID))
	}
	if receiveIn {
		s.adjustProductStock(item.ProductID, int(item.Qty), "CLAIM_IN",
			fmt.Sprintf("รับสินค้าทดแทนจากซัพพลายเออร์ (รายการเคลม #%d)", item.ID))
	}
	if reverseOut {
		s.adjustProductStock(item.ProductID, int(reverseQty), "CLAIM_REVERSE",
			fmt.Sprintf("คืนสต็อกสินค้าที่เคยจ่ายออก เนื่องจากใบเคลมถูกตีกลับ (รายการเคลม #%d)", item.ID))
	}
}

func (s *customerClaimService) adjustProductStock(productID uint, delta int, movementType, note string) {
	if err := s.repo.AdjustProductStock(productID, delta, movementType, note); err != nil {
		fmt.Printf("[Stock] failed to adjust product %d stock (%s): %v\n", productID, movementType, err)
	}
}

// prepareCreditFlag: ตรวจว่าต้อง "หักยอดหนี้ค้างชำระเข้าบัญชีเชื่อ" ของลูกค้าหรือยัง สำหรับรายการเคลม
// ประเภท CREDIT_ACCOUNT (ลงบัญชีเชื่อ) ที่เพิ่งได้รับการอนุมัติ (APPROVED) โดยเช็ค CreditApplied เดิมของ item
// กันไม่ให้หักซ้ำเวลาสถานะถูกสลับไปมา (เช่น อนุมัติ -> ปฏิเสธ -> อนุมัติใหม่) เพราะยอดหนี้ถูกหักจริงแค่ครั้งเดียว
//
// reverseCredit: เคยหักหนี้ไปแล้ว (CreditApplied=true) แต่สถานะถูกเปลี่ยนออกจาก APPROVED ทีหลัง ต้องคืนยอด
// หนี้ที่เคยหักกลับให้ลูกค้าทันที ไม่งั้นลูกค้าจะเสียเครดิตฟรีทั้งที่ไม่มีการอนุมัติจริงอยู่แล้ว
func prepareCreditFlag(item *entity.CustomerClaimItem) (applyCredit, reverseCredit bool) {
	claimTypeUp := strings.ToUpper(strings.TrimSpace(item.ClaimType))
	statusUp := strings.ToUpper(strings.TrimSpace(item.Status))
	if !item.CreditApplied && claimTypeUp == "CREDIT_ACCOUNT" && statusUp == "APPROVED" {
		item.CreditApplied = true
		return true, false
	}
	if item.CreditApplied && claimTypeUp == "CREDIT_ACCOUNT" && statusUp != "APPROVED" {
		item.CreditApplied = false
		return false, true
	}
	return false, false
}

// applyCreditAdjustment: reverseAmount คือยอดที่ต้อง "คืน" ให้ลูกค้า ระบุแยกจาก item.Qty*item.UnitPrice
// ด้วยเหตุผลเดียวกับ applyStockAdjustments — ต้องคืนตามยอดที่เคยหักไปจริง (ก่อนแก้ไข) ไม่ใช่ยอดใหม่ล่าสุด
func (s *customerClaimService) applyCreditAdjustment(item *entity.CustomerClaimItem, applyCredit, reverseCredit bool, reverseAmount float64) {
	if applyCredit {
		amount := float64(item.Qty) * item.UnitPrice
		if amount > 0 {
			if err := s.repo.ReduceCustomerDebtForClaim(item.CustomerClaimID, amount); err != nil {
				fmt.Printf("[Credit] failed to reduce customer debt (claim item %d): %v\n", item.ID, err)
			}
		}
		return
	}
	if reverseCredit && reverseAmount > 0 {
		if err := s.repo.IncreaseCustomerDebtForClaim(item.CustomerClaimID, reverseAmount); err != nil {
			fmt.Printf("[Credit] failed to restore customer debt (claim item %d): %v\n", item.ID, err)
		}
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
	var issueOut, receiveIn, reverseOut, applyCredit, reverseCredit bool
	var oldQty uint
	var oldUnitPrice float64
	var wasStockOutIssued, wasStockInReceived, wasCreditApplied bool
	updated, err := s.repo.UpdateCustomerClaimItemWithLock(id, func(existing *entity.CustomerClaimItem) error {
		if existing.Resolution == "COMPLETED" || strings.Contains(existing.Resolution, "ส่งมอบ") || strings.Contains(existing.Resolution, "สำเร็จ") {
			return ErrClaimItemAlreadyDelivered
		}
		oldQty = existing.Qty
		oldUnitPrice = existing.UnitPrice
		wasStockOutIssued = existing.StockOutIssued
		wasStockInReceived = existing.StockInReceived
		wasCreditApplied = existing.CreditApplied

		if input.Qty > 0 {
			existing.Qty = uint(input.Qty)
		}
		if input.UnitPrice > 0 {
			existing.UnitPrice = input.UnitPrice
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
		issueOut, receiveIn, reverseOut = prepareStockFlags(existing)
		applyCredit, reverseCredit = prepareCreditFlag(existing)
		return nil
	})
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.applyStockAdjustments(updated, issueOut, receiveIn, reverseOut, oldQty)
	s.applyCreditAdjustment(updated, applyCredit, reverseCredit, qtyAmount(oldQty, oldUnitPrice))

	// ปรับส่วนต่างจำนวน/ราคา สำหรับรายการที่ตัด/เติมสต็อก+หักหนี้ไปแล้วจริงตั้งแต่ก่อนหน้านี้ (flag ยังเป็น true
	// เหมือนเดิม ไม่ได้เพิ่งเกิด/ถูกยกเลิกในรอบนี้) แต่ถูกแก้จำนวน/ราคาภายหลัง เพื่อให้สต็อก/หนี้ที่ปรับจริง
	// ตรงกับตัวเลขล่าสุดในใบเคลมเสมอ — ถ้าไม่ทำ แก้จำนวนหลังอนุมัติแล้วจะไม่กระทบสต็อก/หนี้ที่ตัดไปแล้วเลย
	if wasStockOutIssued && updated.StockOutIssued && !issueOut && !reverseOut && updated.Qty != oldQty {
		qtyDelta := int(updated.Qty) - int(oldQty)
		s.adjustProductStock(updated.ProductID, -qtyDelta, "CLAIM_ADJUST",
			fmt.Sprintf("ปรับสต็อกตามจำนวนที่แก้ไขใหม่ของรายการเคลม #%d", updated.ID))
	}
	if wasStockInReceived && updated.StockInReceived && !receiveIn && updated.Qty != oldQty {
		qtyDelta := int(updated.Qty) - int(oldQty)
		s.adjustProductStock(updated.ProductID, qtyDelta, "CLAIM_ADJUST",
			fmt.Sprintf("ปรับสต็อกรับเข้าตามจำนวนที่แก้ไขใหม่ของรายการเคลม #%d", updated.ID))
	}
	if wasCreditApplied && updated.CreditApplied && !applyCredit && !reverseCredit {
		oldAmount := qtyAmount(oldQty, oldUnitPrice)
		newAmount := float64(updated.Qty) * updated.UnitPrice
		if amountDelta := newAmount - oldAmount; amountDelta > 0 {
			if err := s.repo.ReduceCustomerDebtForClaim(updated.CustomerClaimID, amountDelta); err != nil {
				fmt.Printf("[Credit] failed to adjust customer debt delta (claim item %d): %v\n", updated.ID, err)
			}
		} else if amountDelta < 0 {
			if err := s.repo.IncreaseCustomerDebtForClaim(updated.CustomerClaimID, -amountDelta); err != nil {
				fmt.Printf("[Credit] failed to restore customer debt delta (claim item %d): %v\n", updated.ID, err)
			}
		}
	}

	s.syncParentClaimStatus(updated.CustomerClaimID)
	return claimDTO.ToCustomerClaimItemResponseDTO(updated), nil
}

func qtyAmount(qty uint, unitPrice float64) float64 {
	return float64(qty) * unitPrice
}

func (s *customerClaimService) UpdateCustomerClaimItemStatus(id uint, status string) (claimDTO.CustomerClaimItemResponseDTO, error) {
	var issueOut, receiveIn, reverseOut, applyCredit, reverseCredit bool
	updated, err := s.repo.UpdateCustomerClaimItemWithLock(id, func(existing *entity.CustomerClaimItem) error {
		if existing.Resolution == "COMPLETED" || strings.Contains(existing.Resolution, "ส่งมอบ") || strings.Contains(existing.Resolution, "สำเร็จ") {
			return ErrClaimItemAlreadyDelivered
		}
		existing.Status = status
		issueOut, receiveIn, reverseOut = prepareStockFlags(existing)
		applyCredit, reverseCredit = prepareCreditFlag(existing)
		return nil
	})
	if err != nil {
		return claimDTO.CustomerClaimItemResponseDTO{}, err
	}
	s.applyStockAdjustments(updated, issueOut, receiveIn, reverseOut, updated.Qty)
	s.applyCreditAdjustment(updated, applyCredit, reverseCredit, float64(updated.Qty)*updated.UnitPrice)
	s.syncParentClaimStatus(updated.CustomerClaimID)
	return claimDTO.ToCustomerClaimItemResponseDTO(updated), nil
}

func (s *customerClaimService) DeleteCustomerClaim(id uint) error {
	return s.repo.DeleteCustomerClaim(id)
}

// CancelCustomerClaim: ยกเลิกใบเคลมที่อนุมัติแล้ว คืนสต็อก/หนี้ที่เคยตัด/หักไปจริงกลับทั้งหมด
// แล้วเปลี่ยนสถานะเป็น CANCELLED (เก็บประวัติไว้ ไม่ลบทิ้ง) — ใช้กับกรณีอนุมัติผิดพลาดที่ต้องย้อนกลับ
func (s *customerClaimService) CancelCustomerClaim(id uint) (claimDTO.CustomerClaimResponseDTO, error) {
	itemsBefore, err := s.repo.CancelCustomerClaim(id)
	if err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}
	for _, item := range itemsBefore {
		if item.StockOutIssued {
			s.adjustProductStock(item.ProductID, int(item.Qty), "CLAIM_CANCEL",
				fmt.Sprintf("ยกเลิกใบเคลม คืนสต็อกสินค้าที่เคยจ่ายออก (รายการเคลม #%d)", item.ID))
		}
		if item.StockInReceived {
			s.adjustProductStock(item.ProductID, -int(item.Qty), "CLAIM_CANCEL",
				fmt.Sprintf("ยกเลิกใบเคลม ตัดสต็อกสินค้าที่เคยรับเข้า (รายการเคลม #%d)", item.ID))
		}
		if item.CreditApplied {
			amount := float64(item.Qty) * item.UnitPrice
			if amount > 0 {
				if err := s.repo.IncreaseCustomerDebtForClaim(item.CustomerClaimID, amount); err != nil {
					fmt.Printf("[Credit] failed to restore customer debt (claim item %d): %v\n", item.ID, err)
				}
			}
		}
	}
	full, err := s.repo.GetCustomerClaimByID(id)
	if err != nil {
		return claimDTO.CustomerClaimResponseDTO{}, err
	}
	return claimDTO.ToCustomerClaimResponseDTO(full), nil
}
