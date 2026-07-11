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
	SearchProducts(query poDto.ProductSearchQuery) ([]poDto.ProductSearchResponse, error)
	// GeneratePDF(ctx context.Context, id uint) (string, error)
}

// purchaseOrderService ตัว Struct หลักที่จะทำงานจริง (Implement Interface ด้านบน)
type purchaseOrderService struct {
	poRepository    poRepo.PurchaseOrderRepository // คุมตาราง purchase_orders และ po_items
	productRepo 	poRepo.ProductRepository      // เอาไว้ไปค้นหาข้อมูลสินค้ามาทำ Snapshot
	supplierRepo 	poRepo.SupplierRepository    // เอาไว้หาข้อมูลซัพพลายเออร์มาทำ Response
	userRepo     	poRepo.UserRepository        // เอาไว้หาชื่อคนสร้าง
}

// NewPurchaseOrderService ฟังก์ชัน Constructor สำหรับทำ DI
func NewPOService(
	poRepo 			poRepo.PurchaseOrderRepository,
	productRepo 	poRepo.ProductRepository,
	supplierRepo 	poRepo.SupplierRepository,
	userRepo 		poRepo.UserRepository,
) PurchaseOrderService {
	return &purchaseOrderService{
		poRepository: poRepo,
		productRepo:  productRepo,
		supplierRepo: supplierRepo,
		userRepo:     userRepo,
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


	poData := &poEntity.PO{
		PO_number:  generatedPONumber, // ใช้เลขที่ Generate ใหม่
		SupplierID: req.SupplierID,
		PO_type_id: req.POTypeID,
		Created_by: creatorID,
		Status:     poEnum.StatusPending,
	}

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
		ID:           poData.ID,
		OrderNumber:  poData.PO_number,
		SupplierID:   poData.SupplierID,
		SupplierName: supplier.SupplierName, 
		POTypeID:     poData.PO_type_id,
		TotalAmount:  totalAmount,
		Status:       poData.Status,
		CreatorID:    poData.Created_by,
		POItems:      poItemResponses,
	}

	return res, nil
}

// แถม: อย่าลืมเขียนอีก 2 ฟังก์ชันที่เหลือให้ครบ ไม่งั้นมันจะฟ้อง missing ตัวอื่นต่อ
func (s *purchaseOrderService) GetPOByID(
	ctx context.Context, 
	id uint,
) (*poDto.PurchaseOrderResponse, error) {
	return nil, nil
}

func (s *purchaseOrderService) UpdatePOStatus(ctx context.Context, id uint, status poEnum.POStatus) error {
	return nil
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
			OrderNumber:  p.PO_number,
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

var (
	ErrPONotFound    = errors.New("purchase order not found")
	ErrPOCannotDelete = errors.New("approved PO cannot be deleted")
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

func (s *purchaseOrderService) SearchProducts(query poDto.ProductSearchQuery) ([]poDto.ProductSearchResponse, error) {
	return s.productRepo.SearchProducts(query.SupplierID, query.Keyword)
}