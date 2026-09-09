package purchaseorders

import (
	"fmt"
	"math"
)

func validateUnitPrice(price float64, preorderID *uint, row int) error {
	preorder := preorderID != nil && *preorderID > 0
	if math.IsNaN(price) || math.IsInf(price, 0) || price < 0 || (price == 0 && !preorder) {
		if preorder {
			return fmt.Errorf("รายการที่ %d: ราคาต่อหน่วยต้องไม่น้อยกว่า 0 และเป็นตัวเลขที่ถูกต้อง", row)
		}
		return fmt.Errorf("รายการที่ %d: ราคาต่อหน่วยต้องมากกว่า 0 และเป็นตัวเลขที่ถูกต้อง", row)
	}
	return nil
}

func (r *CreatePurchaseOrderRequest) ValidatePrices() error {
	for i, item := range r.POItems {
		if item.ProductID == 0 && (item.PreOrderItemID == nil || *item.PreOrderItemID == 0) {
			return fmt.Errorf("รายการที่ %d: กรุณาเลือกสินค้าหรือรายการพรีออเดอร์", i+1)
		}
		if err := validateUnitPrice(item.UnitPrice, item.PreOrderItemID, i+1); err != nil {
			return err
		}
	}
	return nil
}

func (r *UpdatePurchaseOrderRequest) ValidatePrices() error {
	for i, item := range r.Items {
		if item.ProductID == 0 && (item.PreOrderItemID == nil || *item.PreOrderItemID == 0) {
			return fmt.Errorf("รายการที่ %d: กรุณาเลือกสินค้าหรือรายการพรีออเดอร์", i+1)
		}
		if err := validateUnitPrice(item.UnitPrice, item.PreOrderItemID, i+1); err != nil {
			return err
		}
	}
	return nil
}
