package lotcode

import "strings"

// Build สร้าง "รหัสประจำบริษัท/ซัพพลายเออร์" (variant code) สำหรับสแกนแยกว่าสินค้าชิ้นนี้รับมาจากบริษัทไหน
// รูปแบบ: {ProductCode}-{ชื่อย่อบริษัท} เช่น TRAGSP-00002-TAP
func Build(productCode, supplierShortName string) string {
	base := strings.TrimSpace(productCode)
	if base == "" {
		base = "P"
	}

	sup := strings.TrimSpace(supplierShortName)
	if sup == "" {
		sup = "XX"
	}

	return base + "-" + sup
}
