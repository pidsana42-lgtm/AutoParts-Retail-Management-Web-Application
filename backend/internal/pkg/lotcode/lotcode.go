package lotcode

import (
	"fmt"
	"strings"
)

// Build สร้าง "รหัสล็อตต่อบริษัท" (variant code) สำหรับสแกนแยกว่าเป็นของบริษัทไหน
// รูปแบบ: {ProductCode}-{SUP}{LotID} เช่น BP-123-SU3
//   - SUP = ตัวอักษร A-Z / เลข 0-9 ที่มาจากชื่อย่อซัพพลายเออร์ (สูงสุด 2 ตัว)
//   - LotID = id ของแถว inventory ทำให้ไม่ซ้ำกันแน่นอนแม้ชื่อย่อซ้ำกัน
func Build(productCode, supplierShortName string, lotID uint) string {
	base := strings.TrimSpace(productCode)
	if base == "" {
		base = fmt.Sprintf("P%d", lotID)
	}

	sup := sanitize(supplierShortName)
	if sup == "" {
		sup = "XX"
	}

	return fmt.Sprintf("%s-%s%d", base, sup, lotID)
}

func sanitize(name string) string {
	var b strings.Builder
	name = strings.ToUpper(strings.TrimSpace(name))
	for _, r := range name {
		if len(b.String()) >= 2 {
			break
		}
		if (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
		}
	}
	return b.String()
}
