package purchaseorders

import (
	poDto 		"backend/internal/app/dto/purchase_orders"
	poEnum 		"backend/internal/app/enum"
	poRepo 		"backend/internal/app/repository/purchase_orders"
	poEntity 	"backend/internal/app/entity"
	"gorm.io/gorm"
	"strings"
	"context"
	"errors"
	"strconv"
	"time"
	"fmt"
	"math"
	"os"
)

// PurchaseOrderService คือพิมพ์เขียวบอกว่า Service นี้ทำอะไรได้บ้าง (ให้ Controller เรียกใช้)
type PurchaseOrderService interface {
	CreatePO(ctx context.Context, req *poDto.CreatePurchaseOrderRequest, creatorID uint) (*poDto.PurchaseOrderResponse, error)
	GetPOByID(ctx context.Context, id uint) (*poDto.PurchaseOrderResponse, error)
	UpdatePOStatus(ctx context.Context, id uint, status poEnum.POStatus) error
	ListPOs(ctx context.Context, query poDto.ListPOQuery) (*poDto.ListPOResponse, error)
	GetPOSummary(ctx context.Context, role string) (*poDto.POSummaryResponse, error)
	GeneratePOPDF(ctx context.Context, id uint) ([]byte, error)
	Delete(ctx context.Context, id uint) error
	SearchProducts(ctx context.Context, query poDto.ProductSearchQuery) ([]poDto.ProductSearchResponse, error)
	UpdatePO(ctx context.Context, id uint, req *poDto.UpdatePurchaseOrderRequest, updatedBy uint) (*poEntity.PO, error)
	GetSupplierDeliveryEstimate(ctx context.Context, supplierID int) (*poDto.POAnalyticsResponse, error)
	GetMonthlyPOCount(ctx context.Context) (int64, error)
}

// purchaseOrderService ตัว Struct หลักที่จะทำงานจริง (Implement Interface ด้านบน)
type purchaseOrderService struct {
	poRepository    poRepo.PurchaseOrderRepository // คุมตาราง purchase_orders และ po_items
	productRepo 	poRepo.ProductRepository      // เอาไว้ไปค้นหาข้อมูลสินค้ามาทำ Snapshot
	inventoryRepo 	poRepo.InventoryRepository    // เอาไว้ค้นหาสินค้าที่ผูกกับ supplier ผ่าน inventory
	supplierRepo 	poRepo.SupplierRepository    // เอาไว้หาข้อมูลซัพพลายเออร์มาทำ Response
	userRepo     	poRepo.UserRepository        // เอาไว้หาชื่อคนสร้าง
	draftExpiryDays int							 // เอาไว้ตั้งค่าอายุใบสั่งซื้อที่เป็นฉบับร่าง
}

// NewPurchaseOrderService ฟังก์ชัน Constructor สำหรับทำ DI
func NewPOService(
	poRepo 			poRepo.PurchaseOrderRepository,
	productRepo 	poRepo.ProductRepository,
	inventoryRepo 	poRepo.InventoryRepository,
	supplierRepo 	poRepo.SupplierRepository,
	userRepo 		poRepo.UserRepository,
	draftExpiryDays int,
) PurchaseOrderService {
	return &purchaseOrderService{
		poRepository: poRepo,
		productRepo:  productRepo,
		inventoryRepo: inventoryRepo,
		supplierRepo: supplierRepo,
		userRepo:     userRepo,
		draftExpiryDays: draftExpiryDays,
	}
}

func (s *purchaseOrderService) CreatePO(ctx context.Context, req *poDto.CreatePurchaseOrderRequest, creatorID uint) (*poDto.PurchaseOrderResponse, error) {
	supplier, err := s.supplierRepo.GetSupplierByID(ctx, req.SupplierID)
	if err != nil {
		return nil, fmt.Errorf("failed to find supplier: %w", err)
	}
	if supplier == nil {
		return nil, errors.New("supplier not found")
	}

	currentYear := time.Now().Format("2006") // ดึงปี ค.ศ. ปัจจุบัน
	prefix := fmt.Sprintf("PO-%s-", currentYear)
	nextSequence := 1 // ค่าเริ่มต้นคือ 1

	// ดึงเลข PO ล่าสุดของปีนี้จาก Repository
	latestPONumber, err := s.poRepository.GetLatestPONumberByYear(ctx, currentYear)
	if err != nil {
		return nil, fmt.Errorf("failed to get latest PO number: %w", err)
	}

	// ถ้ามีเลขล่าสุดอยู่แล้ว (เช่น "PO-2026-0015") ให้เอามาตัดแล้วบวก 1
	if latestPONumber != "" {
		parts := strings.Split(latestPONumber, "-")
		if len(parts) == 3 {
			lastSeq, err := strconv.Atoi(parts[2])
			if err == nil {
				nextSequence = lastSeq + 1
			}
		}
	}

	// เติม 0 ให้ครบ 4 หลัก
	generatedPONumber := fmt.Sprintf("%s%04d", prefix, nextSequence)

	hasPurchase := false
    hasPreOrder := false

	var totalAmount float64 = 0
	var poItems []poEntity.POItems

	for _, item := range req.POItems {
		product, err := s.productRepo.GetProductByID(ctx, item.ProductID)
		if err != nil {
			return nil, fmt.Errorf("failed to find product ID %d: %w", item.ProductID, err)
		}
		if product == nil {
			return nil, fmt.Errorf("product ID %d not found", item.ProductID)
		}

		productName := product.Product_Name
		productCode := product.Product_Code
		var unitName string
		if product.Unit != nil {
			unitName = product.Unit.Unit_Name
		}

        if item.PreOrderItemID != nil {
            hasPreOrder = true
        } else {
            hasPurchase = true
        }

		subTotal := float64(item.Quantity) * item.UnitPrice
		totalAmount += subTotal

		poItem := poEntity.POItems{
			ProductID:                    item.ProductID,
			Product_name_snapshot:        productName,
			Supply_product_code_snapshot: productCode,
			Quantity:                     float64(item.Quantity),
			Unit:                         unitName,
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
		PO_number:  generatedPONumber, // ใช้เลขที่ Generate ใหม่
		SupplierID: req.SupplierID,
		PO_type_id: poTypeID,
		Created_by: creatorID,
		Status:     req.Status,
		PO_Items:   poItems,
        Total_amount: totalAmount,
	}

	if req.Status == poEnum.StatusDraft {
		expiry := time.Now().AddDate(0, 0, s.draftExpiryDays)
		poData.Expires_at = &expiry
	}
	poData.PO_Items = poItems
	poData.Total_amount = totalAmount

	if err := s.poRepository.SavePO(ctx, poData); err != nil {
		return nil, fmt.Errorf("failed to save purchase order: %w", err)
	}

	var poItemResponses []poDto.POItemResponse
	for _, item := range poData.PO_Items {
		
		var notesStr string
		if item.Notes != nil {
			notesStr = *item.Notes
		}

		poItemResponses = append(poItemResponses, poDto.POItemResponse{
			ID:                        item.ID,
			ProductID:                 item.ProductID,
			ProductNameSnapshot:       item.Product_name_snapshot,
			SupplyProductCodeSnapshot: item.Supply_product_code_snapshot,
			Quantity:                  int(item.Quantity),      
			Unit:                      item.Unit,
			UnitPrice:                 item.UnitPrice,
			SubTotal:                  item.SubTotal,
			Notes:                     notesStr,
			AlertID:                   item.AlertID,
			PreOrderItemID:            item.PreOrderItemID,
		})
	}

	res := &poDto.PurchaseOrderResponse{
		ID:           	poData.ID,
		PONumber:  		poData.PO_number,
		SupplierID:   	poData.SupplierID,
		SupplierName: 	supplier.SupplierName, 
		POTypeID:     	poData.PO_type_id,
		TotalAmount:  	totalAmount,
		Status:       	poData.Status,
		Expires_at:    	*poData.Expires_at,
		CreatorID:    	poData.Created_by,
		POItems:      	poItemResponses,
	}

	return res, nil
}

// ดึง PO ด้วย POID
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
		var notesStr string
		if item.Notes != nil {
			notesStr = *item.Notes
		}

		orderType := "สั่งซื้อ"
		if item.PreOrderItemID != nil {
			orderType = "พรีออเดอร์"
		}

		itemResponses = append(itemResponses, poDto.POItemResponse{
			ID:                        item.ID,
			ProductID:                 item.ProductID,
			ProductNameSnapshot:       item.Product_name_snapshot,
			SupplyProductCodeSnapshot: item.Supply_product_code_snapshot,
			Quantity:                  int(item.Quantity),
			Unit:                      item.Unit,
			UnitPrice:                 item.UnitPrice,
			SubTotal:                  item.SubTotal,
			Notes:                     notesStr,
			AlertID:                   item.AlertID,
			PreOrderItemID:            item.PreOrderItemID,
			OrderType: 				   orderType,		
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
		PONumber:  po.PO_number,
		SupplierID:   po.SupplierID,
		SupplierName: supplierName,
		POTypeID:     po.PO_type_id,
		TotalAmount:  po.Total_amount,
		Status:       poEnum.POStatus(po.Status),
		CreatorID:    po.Created_by,
		CreatorName:  creatorName,
		CreatedAt:    po.CreatedAt,
		UpdatedAt:    po.UpdatedAt,
		POItems:      itemResponses,
	}, nil
}

func (s *purchaseOrderService) UpdatePOStatus(ctx context.Context, id uint, status poEnum.POStatus) error {
	po, err := s.poRepository.GetPOByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrPONotFound
		}
		return err
	}

	// กันไว้: PO ที่อนุมัติไปแล้ว ไม่ควรเปลี่ยนสถานะซ้ำได้อีก
	if po.Status == poEnum.StatusApproved {
		return ErrPOCannotUpdate
	}

	po.Status = status
	return s.poRepository.UpdatePO(ctx, po)
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
				ProductID:                 item.ProductID,
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

		// 2. จัดการข้อมูล PO หลัก
		data = append(data, poDto.PurchaseOrderResponse{
			ID:           p.ID,
			PONumber:  p.PO_number,
			SupplierID:   p.SupplierID,
			SupplierName: supplierName,
			POTypeID:     p.PO_type_id,
			TotalAmount:  p.Total_amount,
			Status:       poEnum.POStatus(p.Status),
			CreatorID:    p.Created_by,
			CreatorName:  creatorName,
			CreatedAt:    p.CreatedAt,
			POItems:      itemResponses, 
		})
    }

    return &poDto.ListPOResponse{
        Data:  data,
        Total: total,
    }, nil
}

func (s *purchaseOrderService) GetPOSummary(ctx context.Context, role string) (*poDto.POSummaryResponse, error) {
	if !strings.EqualFold(role, "Owner") {
		return nil, errors.New("forbidden: only owner can view PO summary")
	}
	return s.poRepository.GetPOSummary(ctx)
}

func (s *purchaseOrderService) GetMonthlyPOCount(ctx context.Context) (int64, error) {
	return s.poRepository.GetMonthlyPOCount(ctx)
}

var (
	ErrPONotFound    = errors.New("purchase order not found")
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

	// 3. delete
	return s.poRepository.DeletePOByID(ctx, id)
}

func (s *purchaseOrderService) SearchProducts(ctx context.Context, query poDto.ProductSearchQuery) ([]poDto.ProductSearchResponse, error) {
	return s.inventoryRepo.SearchProducts(ctx, query.SupplierID, query.Keyword)
}

// Update 
func (s *purchaseOrderService) UpdatePO(ctx context.Context, id uint, req *poDto.UpdatePurchaseOrderRequest, updatedBy uint) (*poEntity.PO, error) {
	po, err := s.poRepository.GetPOByID(ctx, id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, ErrPONotFound
		}
		return nil, err
	}

	if po.Status != "DRAFT" && po.Status != "PENDING" && po.Status != "REJECTED" {
		return nil, ErrPOCannotUpdate
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

    hasPurchase := false
    hasPreOrder := false

    for _, it := range req.Items {
        product, err := s.productRepo.GetProductByID(ctx, it.ProductID)
        if err != nil || product == nil {
            return nil, fmt.Errorf("failed to find product ID %d", it.ProductID)
        }

        var unitName string
        if product.Unit != nil {
            unitName = product.Unit.Unit_Name
        }

        subTotal := float64(it.Quantity) * it.UnitPrice
        item := poEntity.POItems{
            ProductID:                    it.ProductID,
            Product_name_snapshot:        product.Product_Name,
            Supply_product_code_snapshot: product.Product_Code, 
            Quantity:                     float64(it.Quantity),
            Unit:                         unitName,
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

func getPODraftExpiryDays() int {
	days, err := strconv.Atoi(os.Getenv("PO_DRAFT_EXPIRY_DAYS"))
	if err != nil || days <= 0 {
		return 7 // ค่า default ถ้าไม่ได้ตั้ง env หรือตั้งค่าผิด
	}
	return days
}