package purchaseorders

import (
	poDto "backend/internal/app/dto/purchase_orders"
	poEntity "backend/internal/app/entity"
	poEnum "backend/internal/app/enum"
	preOrderRepo "backend/internal/app/repository/pre_oder"
	poRepo "backend/internal/app/repository/purchase_orders"
	wmsRepo "backend/internal/app/repository/wms"
	svcNotification "backend/internal/app/service/notification"
	"context"
	"errors"
	"fmt"
	"gorm.io/gorm"
	"log"
	"math"
	"strings"
	"time"
)

// PurchaseOrderService คือพิมพ์เขียวบอกว่า Service นี้ทำอะไรได้บ้าง (ให้ Controller เรียกใช้)
type PurchaseOrderService interface {
	CreatePO(ctx context.Context, req *poDto.CreatePurchaseOrderRequest, creatorID uint) (*poDto.PurchaseOrderResponse, error)
	GetPOByID(ctx context.Context, id uint) (*poDto.PurchaseOrderResponse, error)
	UpdatePOStatus(ctx context.Context, id uint, status poEnum.POStatus, updatedBy uint) error
	ListPOs(ctx context.Context, query poDto.ListPOQuery) (*poDto.ListPOResponse, error)
	GetAvailableYears(ctx context.Context) ([]int, error)
	GetPOSummary(ctx context.Context, role string) (*poDto.POSummaryResponse, error)
	GeneratePOPDF(ctx context.Context, id uint, includeCode bool, printedBy uint) ([]byte, error)
	Delete(ctx context.Context, id uint) error
	SearchProducts(ctx context.Context, query poDto.ProductSearchQuery) ([]poDto.ProductSearchResponse, error)
	UpdatePO(ctx context.Context, id uint, req *poDto.UpdatePurchaseOrderRequest, updatedBy uint) (*poEntity.PO, error)
	GetSupplierDeliveryEstimate(ctx context.Context, supplierID int) (*poDto.POAnalyticsResponse, error)
	GetMonthlyPOCount(ctx context.Context) (*poDto.POMonthlyCountResponse, error)
	RestorePO(ctx context.Context, poID uint, userID uint) error
	SendStaleDraftReminders(ctx context.Context) error
	PurgeDeletedPOs(ctx context.Context, cutoff time.Time) (int64, error)
}

// purchaseOrderService ตัว Struct หลักที่จะทำงานจริง (Implement Interface ด้านบน)
type purchaseOrderService struct {
	poRepository   poRepo.PurchaseOrderRepository
	productRepo    poRepo.ProductRepository
	inventoryRepo  poRepo.InventoryRepository
	supplierRepo   poRepo.SupplierRepository
	userRepo       poRepo.UserRepository
	preOrderRepo   preOrderRepo.PreOrderRepository
	stockAlertRepo wmsRepo.StockAlertRepository
	notification   svcNotification.NotificationService
}

// NewPurchaseOrderService ฟังก์ชัน Constructor สำหรับทำ DI
func NewPOService(
	poRepo poRepo.PurchaseOrderRepository,
	productRepo poRepo.ProductRepository,
	inventoryRepo poRepo.InventoryRepository,
	supplierRepo poRepo.SupplierRepository,
	preOrderRepo preOrderRepo.PreOrderRepository,
	userRepo poRepo.UserRepository,
	stockAlertRepo wmsRepo.StockAlertRepository,
	notificationService svcNotification.NotificationService,
) PurchaseOrderService {
	return &purchaseOrderService{
		poRepository:   poRepo,
		productRepo:    productRepo,
		inventoryRepo:  inventoryRepo,
		supplierRepo:   supplierRepo,
		preOrderRepo:   preOrderRepo,
		userRepo:       userRepo,
		stockAlertRepo: stockAlertRepo,
		notification:   notificationService,
	}
}

func (s *purchaseOrderService) CreatePO(ctx context.Context, req *poDto.CreatePurchaseOrderRequest, creatorID uint) (*poDto.PurchaseOrderResponse, error) {
	if err := req.ValidatePrices(); err != nil {
		return nil, err
	}
	supplier, err := s.supplierRepo.GetSupplierByID(ctx, req.SupplierID)
	if err != nil {
		return nil, fmt.Errorf("failed to find supplier: %w", err)
	}
	if supplier == nil {
		return nil, errors.New("supplier not found")
	}

	// Owner ที่เลือกส่งอนุมัติ ให้สร้างเป็น APPROVED ตั้งแต่ transaction แรก
	// เพื่อไม่ให้ PO ค้างเป็น PENDING หาก request อนุมัติรอบที่สองล้มเหลว
	finalStatus := req.Status
	var approvedBy *uint
	var approvedAt *time.Time
	if req.Status == poEnum.StatusPending {
		creator, err := s.userRepo.FindByID(ctx, creatorID)
		if err != nil {
			return nil, fmt.Errorf("failed to load PO creator: %w", err)
		}
		if creator.Role.RoleName == poEnum.RoleOwner {
			finalStatus = poEnum.StatusApproved
			approvedBy = &creatorID
			now := time.Now()
			approvedAt = &now
		}
	}

	hasPurchase := false
	hasPreOrder := false

	var totalAmount float64 = 0
	var poItems []poEntity.POItems

	for _, item := range req.POItems {
		product, err := s.resolveProductSnapshot(ctx, item.ProductID, item.PreOrderItemID, req.SupplierID)
		if err != nil {
			return nil, err
		}

		if item.PreOrderItemID != nil {
			hasPreOrder = true
		} else {
			hasPurchase = true
		}

		subTotal := float64(item.Quantity) * item.UnitPrice
		totalAmount += subTotal

		poItem := poEntity.POItems{
			ProductID:                    product.id,
			Product_name_snapshot:        product.name,
			Supply_product_code_snapshot: product.code,
			Quantity:                     float64(item.Quantity),
			Unit:                         product.unit,
			UnitPrice:                    item.UnitPrice,
			SubTotal:                     subTotal,
			Notes:                        item.Notes,
			AlertID:                      item.AlertID,
			PreOrderItemID:               item.PreOrderItemID,
		}
		poItems = append(poItems, poItem)
	}

	var poTypeID uint = 1 // Default เป็น สั่งซื้อปกติ
	if hasPurchase && hasPreOrder {
		poTypeID = 3 // ผสม
	} else if hasPreOrder && !hasPurchase {
		poTypeID = 2 // พรีออเดอร์
	}

	poData := &poEntity.PO{
		SupplierID:    req.SupplierID,
		PO_type_id:    poTypeID,
		Created_by:    creatorID,
		LastUpdatedBy: &creatorID,
		Status:        finalStatus,
		Notes:         req.Notes,
		PO_Items:      poItems,
		Total_amount:  totalAmount,
		Approved_by:   approvedBy,
		Approved_at:   approvedAt,
	}

	if err := s.poRepository.SavePO(ctx, poData); err != nil {
		return nil, fmt.Errorf("failed to save purchase order: %w", err)
	}

	if poData.Status == poEnum.StatusPending {
		s.notifyOwnersOfPendingApproval(ctx, poData, creatorID)
	}
	// Approval does not replenish stock. Keep linked alerts visible (with HasPO)
	// until the stock monitor observes quantity above the reorder threshold.

	// จองไอเทม PreOrder
	var preOrderItemIDs []uint
	for _, item := range req.POItems {
		if item.PreOrderItemID != nil {
			preOrderItemIDs = append(preOrderItemIDs, *item.PreOrderItemID)
		}
	}
	if len(preOrderItemIDs) > 0 {
		_ = s.preOrderRepo.UpdateItemsStatusByIDs(ctx, preOrderItemIDs, "RESERVED")
	}

	// โหลดกลับมาใหม่เฉพาะเพื่อเอา Creator/UpdatedByUser ที่ preload มาด้วย (ใช้ repo เดิม ไม่ต้องเพิ่ม method)
	savedPO, err := s.poRepository.GetPOWithRelations(ctx, poData.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to reload purchase order: %w", err)
	}

	var poItemResponses []poDto.POItemResponse
	for _, item := range poData.PO_Items { // items ยังวนจาก poData เหมือนเดิม ไม่เปลี่ยน
		var notesStr string
		if item.Notes != nil {
			notesStr = *item.Notes
		}
		orderType := "สั่งซื้อ"
		if item.PreOrderItemID != nil {
			orderType = "พรีออเดอร์"
		}
		poItemResponses = append(poItemResponses, poDto.POItemResponse{
			ID:                        item.ID,
			ProductID:                 poProductID(item.ProductID),
			ProductNameSnapshot:       item.Product_name_snapshot,
			SupplyProductCodeSnapshot: item.Supply_product_code_snapshot,
			Quantity:                  int(item.Quantity),
			Unit:                      item.Unit,
			UnitPrice:                 item.UnitPrice,
			SubTotal:                  item.SubTotal,
			Notes:                     notesStr,
			AlertID:                   item.AlertID,
			PreOrderItemID:            item.PreOrderItemID,
			OrderType:                 orderType,
		})
	}

	res := &poDto.PurchaseOrderResponse{
		ID:           poData.ID,
		PONumber:     poData.PO_number,
		SupplierID:   poData.SupplierID,
		SupplierName: supplier.SupplierName,
		POTypeID:     poData.PO_type_id,
		Notes:        poData.Notes,
		TotalAmount:  totalAmount,
		Status:       poData.Status,
		CreatorID:    poData.Created_by,
		CreatorName:  savedPO.Creator.FirstName + " " + savedPO.Creator.LastName,
		POItems:      poItemResponses,
	}

	if savedPO.UpdatedByUser != nil {
		res.UpdatedByID = savedPO.LastUpdatedBy
		updatedByName := savedPO.UpdatedByUser.FirstName + " " + savedPO.UpdatedByUser.LastName
		res.UpdatedByName = &updatedByName
	}

	return res, nil
}

func (s *purchaseOrderService) GetPOByID(ctx context.Context, id uint) (*poDto.PurchaseOrderResponse, error) {
	po, err := s.poRepository.GetPOWithRelations(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPONotFound
		}
		return nil, err
	}

	var itemResponses []poDto.POItemResponse
	for _, item := range po.PO_Items {
		var itemNotesStr string // ← เปลี่ยนชื่อกันสับสนกับของ PO
		if item.Notes != nil {
			itemNotesStr = *item.Notes
		}

		orderType := "สั่งซื้อ"
		if item.PreOrderItemID != nil {
			orderType = "พรีออเดอร์"
		}

		itemResponses = append(itemResponses, poDto.POItemResponse{
			ID:                        item.ID,
			ProductID:                 poProductID(item.ProductID),
			ProductNameSnapshot:       item.Product_name_snapshot,
			SupplyProductCodeSnapshot: item.Supply_product_code_snapshot,
			Quantity:                  int(item.Quantity),
			Unit:                      item.Unit,
			UnitPrice:                 item.UnitPrice,
			SubTotal:                  item.SubTotal,
			Notes:                     itemNotesStr, // ← ใช้ตัวที่ rename แล้ว
			AlertID:                   item.AlertID,
			PreOrderItemID:            item.PreOrderItemID,
			OrderType:                 orderType,
		})
	}

	supplierName := ""
	if po.Supplier.ID != 0 {
		supplierName = po.Supplier.SupplierName
	}

	creatorName := ""
	if po.Creator.ID != 0 {
		creatorName = po.Creator.FirstName + " " + po.Creator.LastName
	}

	return &poDto.PurchaseOrderResponse{
		ID:           po.ID,
		PONumber:     po.PO_number,
		SupplierID:   po.SupplierID,
		SupplierName: supplierName,
		POTypeID:     po.PO_type_id,
		TotalAmount:  po.Total_amount,
		Status:       poEnum.POStatus(po.Status),
		Notes:        po.Notes,
		CreatorID:    po.Created_by,
		CreatorName:  creatorName,
		CreatedAt:    po.CreatedAt,
		UpdatedAt:    po.UpdatedAt,
		POItems:      itemResponses,
	}, nil
}

func (s *purchaseOrderService) UpdatePOStatus(ctx context.Context, id uint, status poEnum.POStatus, updatedBy uint) error {
	if status == poEnum.StatusDeleted {
		return errors.New("ไม่สามารถตั้งสถานะนี้โดยตรง กรุณาใช้ฟังก์ชันลบ/กู้คืน")
	}

	po, err := s.poRepository.GetPOByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrPONotFound
		}
		return err
	}

	if po.Status == poEnum.StatusApproved {
		return ErrPOCannotUpdate
	}

	// RESUBMITTED และ CANCELLED ต้องปลดล็อก PreOrder items กลับเป็น PENDING
	if status == poEnum.StatusResubmitted || status == poEnum.StatusCancelled {
		var preOrderItemIDs []uint
		for _, item := range po.PO_Items {
			if item.PreOrderItemID != nil {
				preOrderItemIDs = append(preOrderItemIDs, *item.PreOrderItemID)
			}
		}
		if len(preOrderItemIDs) > 0 {
			_ = s.preOrderRepo.UpdateItemsStatusByIDs(ctx, preOrderItemIDs, string(poEnum.StatusPending))
		}
		return s.poRepository.UpdateStatus(ctx, id, status, updatedBy)
	}

	po.Status = status
	po.LastUpdatedBy = &updatedBy
	if status == poEnum.StatusApproved {
		po.Approved_by = &updatedBy
		now := time.Now()
		po.Approved_at = &now

		// Receiving stock, not approving this PO, resolves its stock alerts.
	}

	if err := s.poRepository.UpdatePO(ctx, po); err != nil {
		return err
	}

	if status == poEnum.StatusPending {
		s.notifyOwnersOfPendingApproval(ctx, po, updatedBy)
	}

	return nil
}

// notifyOwnersOfPendingApproval แจ้งเจ้าของร้านเมื่อมีใบสั่งซื้อถูกส่งเข้ามาขออนุมัติ
// (ข้ามการแจ้งเตือนถ้าคนส่งเองเป็นเจ้าของร้าน เพราะฝั่ง frontend จะอนุมัติอัตโนมัติต่อทันทีอยู่แล้ว)
func (s *purchaseOrderService) notifyOwnersOfPendingApproval(ctx context.Context, po *poEntity.PO, actorID uint) {
	if s.notification == nil {
		return
	}

	actor, err := s.userRepo.FindByID(ctx, actorID)
	if err != nil {
		log.Printf("[po-notify] failed to load actor %d for PO %s: %v", actorID, po.PO_number, err)
		return
	}
	if actor.Role.RoleName == poEnum.RoleOwner {
		return
	}

	title := "มีใบสั่งซื้อรออนุมัติใหม่"
	message := fmt.Sprintf("พนักงานส่งใบสั่งซื้อ %s เข้ามาขออนุมัติ กรุณาตรวจสอบ", po.PO_number)
	link := fmt.Sprintf("/owner/orders/%d", po.ID)

	if err := s.notification.NotifyOwners("PO_PENDING_APPROVAL", title, message, link, nil); err != nil {
		log.Printf("[po-notify] failed to notify owners for PO %s: %v", po.PO_number, err)
	}
}

func (s *purchaseOrderService) ListPOs(ctx context.Context, query poDto.ListPOQuery) (*poDto.ListPOResponse, error) {
	po, total, err := s.poRepository.FindAll(ctx, query)
	if err != nil {
		return nil, err
	}

	var data []poDto.PurchaseOrderResponse
	for _, p := range po {
		var itemResponses []poDto.POItemResponse
		for _, item := range p.PO_Items {
			itemResponses = append(itemResponses, poDto.POItemResponse{
				ID:                        item.ID,
				ProductID:                 poProductID(item.ProductID),
				ProductNameSnapshot:       item.Product_name_snapshot,
				SupplyProductCodeSnapshot: item.Supply_product_code_snapshot,
				Quantity:                  int(item.Quantity),
				Unit:                      item.Unit,
				UnitPrice:                 item.UnitPrice,
				SubTotal:                  item.SubTotal,
				AlertID:                   item.AlertID,
				PreOrderItemID:            item.PreOrderItemID,
			})
		}

		supplierName := ""
		if p.Supplier.ID != 0 {
			supplierName = p.Supplier.SupplierName
		}

		creatorName := ""
		if p.Creator.ID != 0 {
			creatorName = p.Creator.FirstName + " " + p.Creator.LastName
		}

		res := poDto.PurchaseOrderResponse{
			ID:           p.ID,
			PONumber:     p.PO_number,
			SupplierID:   p.SupplierID,
			SupplierName: supplierName,
			POTypeID:     p.PO_type_id,
			TotalAmount:  p.Total_amount,
			Status:       poEnum.POStatus(p.Status),
			CreatorID:    p.Created_by,
			CreatorName:  creatorName,
			CreatedAt:    p.CreatedAt,
			UpdatedAt:    p.UpdatedAt,
			POItems:      itemResponses,
		}

		if p.UpdatedByUser != nil {
			res.UpdatedByID = p.LastUpdatedBy
			updatedByName := p.UpdatedByUser.FirstName + " " + p.UpdatedByUser.LastName
			res.UpdatedByName = &updatedByName
		}

		data = append(data, res)
	}

	return &poDto.ListPOResponse{
		Data:  data,
		Total: total,
	}, nil
}

func (s *purchaseOrderService) GetAvailableYears(ctx context.Context) ([]int, error) {
	years, err := s.poRepository.FindAvailableYears(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get available years: %w", err)
	}

	// เผื่อปีปัจจุบันยังไม่มี PO เลย ก็ยังให้เลือกได้
	currentYear := time.Now().Year()
	for _, y := range years {
		if y == currentYear {
			return years, nil
		}
	}
	return append([]int{currentYear}, years...), nil
}

func (s *purchaseOrderService) GetPOSummary(ctx context.Context, role string) (*poDto.POSummaryResponse, error) {
	if !strings.EqualFold(role, "Owner") {
		return nil, errors.New("forbidden: only owner can view PO summary")
	}
	return s.poRepository.GetPOSummary(ctx)
}

func (s *purchaseOrderService) GetMonthlyPOCount(ctx context.Context) (*poDto.POMonthlyCountResponse, error) {
	return s.poRepository.GetMonthlyPOCount(ctx)
}

var (
	ErrPONotFound     = errors.New("purchase order not found")
	ErrPOCannotDelete = errors.New("approved PO cannot be deleted")
	ErrPOCannotUpdate = errors.New("approved PO cannot be updated")
)

// Delete แบบ Soft ให้กู้คืนได้
func (s *purchaseOrderService) Delete(ctx context.Context, id uint) error {
	// 1. ดึงข้อมูล
	po, err := s.poRepository.GetPOByID(ctx, id)

	// ดัก Error ถ้า Repo ส่ง gorm.ErrRecordNotFound มา ให้แปลงเป็น ErrPONotFound
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrPONotFound
	}
	// ถ้ามี Error อื่นๆ (เช่น Database พัง) ก็ให้ส่งต่อปกติ
	if err != nil {
		return err
	}

	// 2. Business rule
	if po.Status == poEnum.StatusApproved {
		return ErrPOCannotDelete // ใช้ตัวแปร Error
	}

	// 3. delete ดึง ID เตรียมไว้ก่อนลบ
	var preOrderItemIDs []uint
	for _, item := range po.PO_Items {
		if item.PreOrderItemID != nil {
			preOrderItemIDs = append(preOrderItemIDs, *item.PreOrderItemID)
		}
	}

	err = s.poRepository.DeletePOByID(ctx, id)
	if err != nil {
		return err
	}

	// 5. ปลดล็อกพรีออเดอร์ที่เคยผูกไว้
	if len(preOrderItemIDs) > 0 {
		_ = s.preOrderRepo.UpdateItemsStatusByIDs(ctx, preOrderItemIDs, "PENDING")
	}

	return nil
}

func (s *purchaseOrderService) SearchProducts(ctx context.Context, query poDto.ProductSearchQuery) ([]poDto.ProductSearchResponse, error) {
	return s.inventoryRepo.SearchProducts(ctx, query.SupplierID, query.Keyword)
}

// Update
func (s *purchaseOrderService) UpdatePO(ctx context.Context, id uint, req *poDto.UpdatePurchaseOrderRequest, updatedBy uint) (*poEntity.PO, error) {
	if err := req.ValidatePrices(); err != nil {
		return nil, err
	}
	po, err := s.poRepository.GetPOByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPONotFound
		}
		return nil, err
	}

	if po.Status != "DRAFT" && po.Status != "PENDING" && po.Status != "RESUBMITTED" {
		return nil, ErrPOCannotUpdate
	}
	// Resolve every item before writing header changes, including manual preorder
	// references. Invalid references must not partially update the PO.
	supplierID := po.SupplierID
	if req.SupplierID != nil {
		supplierID = *req.SupplierID
	}
	snapshots := make([]poProductSnapshot, len(req.Items))
	for i, item := range req.Items {
		snapshot, err := s.resolveProductSnapshot(ctx, item.ProductID, item.PreOrderItemID, supplierID)
		if err != nil {
			return nil, err
		}
		snapshots[i] = snapshot
	}

	if req.SupplierID != nil {
		po.SupplierID = *req.SupplierID
	}
	if req.POTypeID != nil {
		po.PO_type_id = *req.POTypeID
	}
	if req.Notes != nil {
		po.Notes = req.Notes
	}

	po.LastUpdatedBy = &updatedBy

	if err := s.poRepository.UpdatePO(ctx, po); err != nil {
		return nil, err
	}

	if req.Items != nil {
		var items []poEntity.POItems
		var total float64

		// จัดการสถานะ PreOrder ตอนแก้ไขบิล
		var addedPreOrderIDs []uint
		var removedPreOrderIDs []uint

		// ก. สร้าง Map ของข้อมูลเก่า และหาตัวที่ถูก "ลบออก"
		oldPreOrderMap := make(map[uint]bool)
		newPreOrderMap := make(map[uint]bool)

		hasPurchase := false
		hasPreOrder := false

		for _, newIt := range req.Items {
			if newIt.PreOrderItemID != nil {
				newPreOrderMap[*newIt.PreOrderItemID] = true
			}
		}

		for _, oldIt := range po.PO_Items {
			if oldIt.PreOrderItemID != nil {
				oldPreOrderMap[*oldIt.PreOrderItemID] = true
				// ถ้าของเก่ามี แต่ของใหม่ไม่มี = ถูกลบออกจากบิล -> ต้องคืนสถานะ PENDING
				if !newPreOrderMap[*oldIt.PreOrderItemID] {
					removedPreOrderIDs = append(removedPreOrderIDs, *oldIt.PreOrderItemID)
				}
			}
		}

		// ข. หาตัวที่ถูก "เพิ่มเข้ามาใหม่"
		for _, newIt := range req.Items {
			// ถ้าของใหม่มี แต่ของเก่าไม่มี = เพิ่งถูกจองเข้ามา -> ต้องล็อกสถานะ RESERVED
			if newIt.PreOrderItemID != nil && !oldPreOrderMap[*newIt.PreOrderItemID] {
				addedPreOrderIDs = append(addedPreOrderIDs, *newIt.PreOrderItemID)
			}
		}

		for i, it := range req.Items {
			product := snapshots[i]

			subTotal := float64(it.Quantity) * it.UnitPrice
			item := poEntity.POItems{
				ProductID:                    product.id,
				Product_name_snapshot:        product.name,
				Supply_product_code_snapshot: product.code,
				Quantity:                     float64(it.Quantity),
				Unit:                         product.unit,
				UnitPrice:                    it.UnitPrice,
				SubTotal:                     subTotal,
			}

			// เอา ID เดิมใส่กลับถ้ามี
			if it.ID != nil {
				item.ID = *it.ID
			}

			// จัดการ PreOrder / Purchase Type
			item.PreOrderItemID = it.PreOrderItemID
			item.AlertID = it.AlertID

			if it.PreOrderItemID != nil {
				hasPreOrder = true
			} else {
				hasPurchase = true
			}

			items = append(items, item)
			total += subTotal // รวมยอดเงินของทั้งบิล
		}

		if err := s.poRepository.SyncItems(ctx, id, items); err != nil {
			return nil, err
		}

		// อัปเดตสถานะใน Database ทีเดียวหลังจาก Sync เสร็จ
		if len(removedPreOrderIDs) > 0 {
			_ = s.preOrderRepo.UpdateItemsStatusByIDs(ctx, removedPreOrderIDs, "PENDING")
		}
		if len(addedPreOrderIDs) > 0 {
			_ = s.preOrderRepo.UpdateItemsStatusByIDs(ctx, addedPreOrderIDs, "RESERVED")
		}

		var newPoTypeID uint = 1 // 1 = สั่งซื้อปกติ (Purchase)
		if hasPurchase && hasPreOrder {
			newPoTypeID = 3 // 3 = ผสม (Mixed)
		} else if hasPreOrder && !hasPurchase {
			newPoTypeID = 2 // 2 = พรีออเดอร์ (PreOrder)
		}
		po.PO_type_id = newPoTypeID
		po.Total_amount = total
	}

	po.LastUpdatedBy = &updatedBy
	if err := s.poRepository.UpdatePO(ctx, po); err != nil {
		return nil, err
	}

	return s.poRepository.GetPOWithRelations(ctx, id)
}

const minSampleSize = 3 // อย่างน้อยต้องมีประวัติกี่ใบถึงจะเชื่อถือได้

func (s *purchaseOrderService) GetSupplierDeliveryEstimate(ctx context.Context, supplierID int) (*poDto.POAnalyticsResponse, error) {
	history, err := s.poRepository.GetSupplierDeliveryHistory(ctx, supplierID)
	if err != nil {
		return nil, fmt.Errorf("failed to get delivery history: %w", err)
	}

	resp := &poDto.POAnalyticsResponse{SupplierID: supplierID}

	if len(history) < minSampleSize {
		resp.HasEnoughData = false
		return resp, nil
	}

	leadTimes := make([]float64, 0, len(history))
	var total float64
	for _, h := range history {
		days := h.ReceivedAt.Sub(h.CreatedAt).Hours() / 24
		leadTimes = append(leadTimes, days)
		total += days
	}
	mean := total / float64(len(leadTimes))

	var sumSq float64
	for _, d := range leadTimes {
		diff := d - mean
		sumSq += diff * diff
	}
	stdDev := math.Sqrt(sumSq / float64(len(leadTimes)))

	accuracy := 100.0
	if mean > 0 {
		accuracy = 100.0 - (stdDev/mean)*100.0
		if accuracy < 0 {
			accuracy = 0
		}
	}

	resp.HasEnoughData = true
	resp.EstimatedDays = int(math.Round(mean))
	resp.AccuracyRate = math.Round(accuracy*100) / 100

	return resp, nil
}

func (s *purchaseOrderService) RestorePO(ctx context.Context, poID uint, userID uint) error {
	return s.poRepository.RestorePOByID(ctx, poID, userID)
}

func (s *purchaseOrderService) PurgeDeletedPOs(ctx context.Context, cutoff time.Time) (int64, error) {
	return s.poRepository.PurgeDeletedPOs(ctx, cutoff)
}

// SendStaleDraftReminders แจ้งเตือนผู้ใช้งานทุกคนเมื่อ PO สถานะ DRAFT/RESUBMITTED ไม่มีความเคลื่อนไหวมาแล้วอย่างน้อย 7 วัน
func (s *purchaseOrderService) SendStaleDraftReminders(ctx context.Context) error {
	cutoff := time.Now().AddDate(0, 0, -7)
	pos, err := s.poRepository.FindDuePOReminders(ctx, cutoff)
	if err != nil {
		return fmt.Errorf("failed to find due PO reminders: %w", err)
	}

	for _, po := range pos {
		var title, message, notifType string
		switch po.Status {
		case poEnum.StatusDraft:
			title = "ใบสั่งซื้อฉบับร่างค้างนาน"
			message = fmt.Sprintf("ใบสั่งซื้อ %s เป็นฉบับร่างค้างไว้นานกว่า 7 วัน กรุณาตรวจสอบและดำเนินการต่อ", po.PO_number)
			notifType = "PO_DRAFT_REMINDER"
		case poEnum.StatusResubmitted:
			title = "ใบสั่งซื้อถูกตีกลับค้างนาน"
			message = fmt.Sprintf("ใบสั่งซื้อ %s ถูกตีกลับให้แก้ไขค้างไว้นานกว่า 7 วัน กรุณาแก้ไขและส่งอนุมัติใหม่", po.PO_number)
			notifType = "PO_RESUBMITTED_REMINDER"
		default:
			continue
		}

		if s.notification != nil {
			ownerLink := fmt.Sprintf("/owner/orders/%d", po.ID)
			if err := s.notification.NotifyOwners(notifType, title, message, ownerLink, nil); err != nil {
				log.Printf("[po-reminder] failed to notify owners (PO %s): %v\n", po.PO_number, err)
			}

			employeeLink := fmt.Sprintf("/employee/orders/%d", po.ID)
			if err := s.notification.NotifyEmployees(notifType, title, message, employeeLink, nil); err != nil {
				log.Printf("[po-reminder] failed to notify employees (PO %s): %v\n", po.PO_number, err)
			}
		}

		if err := s.poRepository.UpdateLastReminderAt(ctx, po.ID, time.Now()); err != nil {
			log.Printf("[po-reminder] failed to update last_reminder_at for PO %s: %v\n", po.PO_number, err)
		}
	}

	return nil
}

// companyProductCodeForSupplier: หารหัสสินค้าที่ Supplier เจ้านี้ใช้เรียกสินค้าชิ้นนี้ (จาก Inventory ที่ preload มาแล้ว)
// CompanyProductCode ย้ายมาอยู่ที่ Inventory แทน Product โดยตรง เพราะสินค้า 1 ชิ้นมาจากหลาย Supplier ได้
// แต่ละเจ้าใช้รหัสของตัวเองไม่เหมือนกัน — คืนค่า CompanyProductCode ของ Supplier เจ้านั้น หรือ fallback เป็น Product_Code ถ้ายังไม่เคยระบุ
func companyProductCodeForSupplier(product *poEntity.Product, supplierID uint) string {
	if product == nil {
		return ""
	}
	for _, inv := range product.Inventories {
		if inv.SupplierID == supplierID && inv.CompanyProductCode != "" {
			return inv.CompanyProductCode
		}
	}
	return product.Product_Code
}
