package claim

import (
	"fmt"
	"math"
)

func validateWholeQuantity(qty float64) error {
	if math.IsNaN(qty) || math.IsInf(qty, 0) || qty <= 0 || qty != math.Trunc(qty) || qty >= float64(^uint(0)) {
		return fmt.Errorf("จำนวนสินค้าเคลมต้องเป็นจำนวนเต็มมากกว่าศูนย์")
	}
	return nil
}

func (d CreateCustomerClaimItemDTO) ValidateQuantity() error {
	return validateWholeQuantity(d.Qty)
}

func (d UpdateCustomerClaimItemDTO) ValidateQuantity() error {
	// The existing update contract uses zero to mean the quantity is unchanged.
	if d.Qty == 0 {
		return nil
	}
	return validateWholeQuantity(d.Qty)
}
