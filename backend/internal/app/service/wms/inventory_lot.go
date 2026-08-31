package wms

import (
	wmsRepo "backend/internal/app/repository/wms"
)

// InventoryLotService: เซอร์วิสจัดการล็อตสินค้าต่อบริษัท + รหัสล็อต (variant code)
// ใช้สำหรับพิมพ์ QR/บาร์โค้ดแยกบริษัท และ resolve โค้ดที่สแกนกลับเป็น "สินค้า + บริษัท"
//
// การใช้งานร่วมกับ POS (อ้างอิงสำหรับต่อยอด — ไม่ผูกกับ flow ขายปัจจุบัน):
//   1. สแกน variant code → GET /api/wms/inventory-lots/resolve?code=BP-123-SU3
//   2. ได้ product_id + supplier_id → นำไปตัด inventories ของเจ้านั้นตามต้องการ
type InventoryLotService interface {
	ListByProduct(productID uint) ([]LotResponse, error)
	ResolveCode(code string) (*LotResolveResponse, error)
	BackfillMissingCodes(productID uint, allProducts bool) (BackfillResponse, error)
}

type inventoryLotService struct {
	repo wmsRepo.InventoryLotRepository
}

func NewInventoryLotService(repo wmsRepo.InventoryLotRepository) InventoryLotService {
	return &inventoryLotService{repo: repo}
}

type LotResponse struct {
	ID           uint   `json:"id"`
	ProductID    uint   `json:"product_id"`
	SupplierID   uint   `json:"supplier_id"`
	SupplierName string `json:"supplier_name"`
	VariantCode  string `json:"variant_code"`
	Quantity     int    `json:"quantity"`
}

type LotResolveResponse struct {
	ProductID      uint   `json:"product_id"`
	ProductCode    string `json:"product_code"`
	ProductName    string `json:"product_name"`
	SupplierID     uint   `json:"supplier_id"`
	SupplierName   string `json:"supplier_name"`
	VariantCode    string `json:"variant_code"`
	Quantity       int    `json:"quantity"`
}

type BackfillResponse struct {
	Updated int64 `json:"updated"`
}

func (s *inventoryLotService) ListByProduct(productID uint) ([]LotResponse, error) {
	lots, err := s.repo.ListByProduct(productID)
	if err != nil {
		return nil, err
	}

	out := make([]LotResponse, 0, len(lots))
	for _, lot := range lots {
		name := ""
		if lot.Supplier != nil {
			name = lot.Supplier.SupplierName
		}
		out = append(out, LotResponse{
			ID:           lot.ID,
			ProductID:    lot.ProductID,
			SupplierID:   lot.SupplierID,
			SupplierName: name,
			VariantCode:  lot.Variant_Code,
			Quantity:     lot.Inventory_Quantity,
		})
	}
	return out, nil
}

func (s *inventoryLotService) ResolveCode(code string) (*LotResolveResponse, error) {
	lot, err := s.repo.ResolveCode(code)
	if err != nil {
		return nil, err
	}

	res := &LotResolveResponse{
		ProductID:   lot.ProductID,
		SupplierID:  lot.SupplierID,
		SupplierName: "",
		VariantCode: lot.Variant_Code,
		Quantity:    lot.Inventory_Quantity,
	}
	if lot.Supplier != nil {
		res.SupplierName = lot.Supplier.SupplierName
	}
	if lot.Product != nil {
		res.ProductCode = lot.Product.Product_Code
		res.ProductName = lot.Product.Product_Name
	}
	return res, nil
}

func (s *inventoryLotService) BackfillMissingCodes(productID uint, allProducts bool) (BackfillResponse, error) {
	updated, err := s.repo.BackfillMissingCodes(productID, allProducts)
	if err != nil {
		return BackfillResponse{}, err
	}
	return BackfillResponse{Updated: updated}, nil
}
