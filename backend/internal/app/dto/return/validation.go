package returns

import (
	"fmt"
	"strings"
)

func validateRefundMethod(method string) error {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case "CASH", "TRANSFER", "QR", "QRCODE", "STORE_CREDIT", "CREDIT":
		return nil
	default:
		return fmt.Errorf("ช่องทางคืนเงินไม่ถูกต้อง")
	}
}

func (d CreateReturnDTO) Validate() error {
	if len(d.SalesReturnItems) == 0 && len(d.Items) == 0 {
		return fmt.Errorf("กรุณาระบุสินค้าที่ต้องการคืนอย่างน้อยหนึ่งรายการ")
	}
	return validateRefundMethod(d.RefundMethod)
}

func (d UpdateReturnDTO) Validate() error {
	if d.RefundMethod == "" {
		return nil
	}
	return validateRefundMethod(d.RefundMethod)
}
