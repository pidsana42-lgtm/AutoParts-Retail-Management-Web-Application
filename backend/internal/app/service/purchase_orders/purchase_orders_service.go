package purchaseorders

import (
	poDto 		"backend/internal/app/dto/purchase_orders"
	poEnum 		"backend/internal/app/enum"
	poRepo 		"backend/internal/app/repository/purchase_orders"
	poEntity 	"backend/internal/app/entity"
	"context"
	"errors"
	"fmt"
)

// PurchaseOrderService คือพิมพ์เขียวบอกว่า Service นี้ทำอะไรได้บ้าง (ให้ Controller เรียกใช้)
type PurchaseOrderService interface {
	CreatePO(ctx context.Context, req *poDto.CreatePurchaseOrderRequest, creatorID uint) (*poDto.PurchaseOrderResponse, error)
	GetPOByID(ctx context.Context, id uint) (*poDto.PurchaseOrderResponse, error)
	UpdatePOStatus(ctx context.Context, id uint, status poEnum.POStatus) error
	ListPOs(ctx context.Context, query poDto.ListPOQuery) (*poDto.ListPOResponse, error)
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

func (s *purchaseOrderService) CreatePO(
	ctx context.Context, 
	req *poDto.CreatePurchaseOrderRequest, // ใส่ชื่อแพ็กเกจย่อยที่ import เข้ามา
	creatorID uint,
) (*poDto.PurchaseOrderResponse, error) { // ตรงนี้ก็ต้องตรงกับสเปก Interface ข้างบน
	
	// เขียน Logic ด้านในชั่วคราวก่อนเพื่อให้คอมไพล์ผ่าน
	// return nil, nil

	supplier, err := s.supplierRepo.GetSupplierByID(ctx, req.SupplierID)
	if err != nil {
		return nil, fmt.Errorf("failed to find supplier: %w", err)
	}
	if supplier == nil {
		return nil, errors.New("supplier not found")
	}

	generatedPONumber := fmt.Sprintf("PO-%s-%d", "20260625", req.SupplierID)

	poData := &poEntity.PO {
		PO_number: generatedPONumber,
		SupplierID: req.SupplierID,
		PO_type_id: req.POTypeID,
		Created_by: creatorID,
		Status: poEnum.StatusPending,
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
        unitName := "ชิ้น"
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

	if err := s.poRepository.Save(ctx, poData); err != nil {
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
    // เรียกผ่าน Repo แทน
    po, total, err := s.poRepository.FindAll(ctx, query)
    if err != nil {
        return nil, err
    }

    // ทำการ Map ข้อมูลจาก entity (po) ไปเป็น dto (data)
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
				// เพิ่มฟิลด์อื่นๆ ถ้า DTO ของคุณมี
			})
		}

		supplierName := ""
		if p.Supplier.ID != 0 {
			supplierName = p.Supplier.SupplierName
		}

		creatorName := ""
		if p.Creator.ID != 0 {
			creatorName = p.Creator.FirstName
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
			POItems:      itemResponses, 
		})
    }

    return &poDto.ListPOResponse{
        Data:  data,
        Total: total,
    }, nil
}