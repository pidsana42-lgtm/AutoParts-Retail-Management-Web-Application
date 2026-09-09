package purchaseorders

import (
	"context"
	"fmt"
	"strings"
)

type poProductSnapshot struct {
	id               *uint
	name, code, unit string
}

// A manual preorder is not a WMS product yet. Keep the actual preorder snapshot
// and a NULL product link rather than inventing a product or saving product_id=0.
func (s *purchaseOrderService) resolveProductSnapshot(ctx context.Context, productID uint, preorderID *uint, supplierID uint) (poProductSnapshot, error) {
	if productID == 0 {
		if preorderID == nil || *preorderID == 0 || s.preOrderRepo == nil {
			return poProductSnapshot{}, fmt.Errorf("กรุณาเลือกสินค้าหรือรายการพรีออเดอร์")
		}
		item, err := s.preOrderRepo.GetPreOrderItemByID(ctx, *preorderID)
		if err != nil || item == nil || item.PreOrder == nil {
			return poProductSnapshot{}, fmt.Errorf("ไม่พบรายการพรีออเดอร์ %d", *preorderID)
		}
		if item.ProductID != nil && *item.ProductID > 0 {
			productID = *item.ProductID
		} else {
			name := strings.TrimSpace(item.ProductNameSnapshot)
			if name == "" {
				return poProductSnapshot{}, fmt.Errorf("รายการพรีออเดอร์ %d ไม่มีชื่อสินค้า", *preorderID)
			}
			code := item.SupplierPartCode
			if code == "" {
				code = item.ProductCodeSnapshot
			}
			return poProductSnapshot{name: name, code: code, unit: "ชิ้น"}, nil
		}
	}
	product, err := s.productRepo.GetProductByID(ctx, productID)
	if err != nil {
		return poProductSnapshot{}, fmt.Errorf("failed to find product ID %d: %w", productID, err)
	}
	if product == nil {
		return poProductSnapshot{}, fmt.Errorf("failed to find product ID %d: product not found", productID)
	}
	unit := ""
	if product.Unit != nil {
		unit = product.Unit.Unit_Name
	}
	return poProductSnapshot{id: &productID, name: product.Product_Name, code: companyProductCodeForSupplier(product, supplierID), unit: unit}, nil
}

// Keep the existing API representation (0 = not yet linked) for older clients.
func poProductID(id *uint) uint {
	if id == nil {
		return 0
	}
	return *id
}
