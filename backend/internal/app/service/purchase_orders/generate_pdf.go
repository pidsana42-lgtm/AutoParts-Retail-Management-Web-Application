package purchaseorders

import (
	"context"
	"fmt"

	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

func (s *purchaseOrderService) GeneratePOPDF(ctx context.Context, poID uint, includeCode bool) ([]byte, error) {
	// 1. ดึงข้อมูลจริงจาก Database
	poData, err := s.poRepository.GetPOForPDF(ctx, poID)
	if err != nil {
		return nil, fmt.Errorf("could not get PO data: %v", err)
	}

	companyData, err := s.poRepository.GetCompanySetting(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not get company data: %v", err)
	}

	// 2. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	poDate := poData.CreatedAt.Format("02/01/2006")

	// 3. ส่วนหัวเอกสาร (ลดขนาด Row ลงให้ดูกระชับ)
	m.RegisterHeader(func() {
		m.Row(25, func() {
			m.Col(3, func() {
				if companyData.LogoURL != "" {
					_ = m.FileImage(companyData.LogoURL, props.Rect{
						Percent: 400,
						Center:  false, // ให้โลโก้ชิดซ้าย
					})
				}
			})
			m.Col(5, func() {}) // ช่องว่างตรงกลาง
			m.Col(4, func() {
				m.Text("ใบสั่งซื้อ", props.Text{
					Size:  24,
					Style: consts.Bold,
					Align: consts.Center,
					Color: hexToColor("#E51C23"),
				})
			})
		})
	})

	m.Row(5, func() {}) // เว้นบรรทัดนิดหน่อย

	// 4. ข้อมูลบริษัท (ซ้าย) และ ข้อมูลเอกสาร (ขวา)
	m.Row(25, func() {
		// ฝั่งซ้าย: ข้อมูลบริษัทเรา
		m.Col(8, func() {
			m.Text(companyData.CompanyName, props.Text{Size: 12, Style: consts.Bold})
			m.Text(companyData.Address, props.Text{Size: 11, Top: 5})
			m.Text(fmt.Sprintf("โทร. %s", companyData.PhoneNumber), props.Text{Size: 11, Top: 10})
			m.Text(fmt.Sprintf("อีเมล %s", companyData.Email), props.Text{Size: 11, Top: 15})
			m.Text(fmt.Sprintf("เลขประจำตัวผู้เสียภาษี %s", companyData.TaxIDNumber), props.Text{Size: 11, Top: 20})
		})
		// ฝั่งขวา: หั่นย่อยเป็น 2 คอลัมน์ (Label กับ Value) เพื่อให้จัดชิดขวาได้เป๊ะๆ
		m.Col(1, func() {
			m.Text("เลขที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Color: hexToColor("#E51C23")})
			m.Text("วันที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: hexToColor("#E51C23")})
			m.Text("ผู้สั่งซื้อ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 10, Color: hexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(poData.PO_number, props.Text{Size: 11, Align: consts.Left})
			m.Text(poDate, props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text(poData.Creator.FirstName+" "+poData.Creator.LastName, props.Text{Size: 11, Align: consts.Left, Top: 10})
		})

	})

	m.Row(5, func() {})

	// 5. ข้อมูลผู้จำหน่าย (กระชับพื้นที่)
	m.Row(15, func() {
		m.Col(12, func() {
			m.Text("ผู้จำหน่าย", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#E51C23")})
			m.Text(poData.Supplier.SupplierName, props.Text{Size: 11, Top: 5})
			m.Text(poData.Supplier.SupplierAddress, props.Text{Size: 11, Top: 10})
		})
	})

	m.Row(5, func() {})

	// 6. สร้างตารางแบบ Manual
	// วาดเส้นขอบบนของ Header
	m.Line(1)

	// หัวตาราง
	// หัวตาราง
	m.Row(8, func() {
		m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Center}) })
		m.Col(1, func() { m.Text("ประเภท", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left}) })
		var colName uint = 5
		if includeCode {
			m.Col(2, func() {
				m.Text("รหัสสินค้า", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left})
			})
			colName = 3
		}
		m.Col(colName, func() {
			m.Text("ชื่อสินค้า", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left})
		})
		m.Col(1, func() {})
		m.Col(2, func() {
			m.Text("จำนวนต่อหน่วย  ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right})
		})
		m.Col(2, func() { m.Text("หน่วย  ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right}) })
	})

	// วาดเส้นขอบล่างของ Header
	m.Line(1)

	// วนลูปข้อมูลสินค้า (Content)
	for i, item := range poData.PO_Items {
		productCode := item.Supply_product_code_snapshot
		if item.Product != nil && item.Product.CompanyProductCode != "" {
			productCode = item.Product.CompanyProductCode
		}
		poType := "สั่งซื้อ"
		if item.PreOrderItemID != nil {
			poType = "พรีออเดอร์"
		}

		var colName uint = 5
		if includeCode {
			colName = 3
		}

		m.Row(7, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 11, Align: consts.Center}) })
			m.Col(1, func() { m.Text(poType, props.Text{Size: 11, Align: consts.Left}) })
			if includeCode {
				m.Col(2, func() { m.Text(productCode, props.Text{Size: 11, Align: consts.Left}) })
			}
			m.Col(colName, func() { m.Text(item.Product_name_snapshot, props.Text{Size: 11}) })
			m.Col(1, func() {})
			m.Col(2, func() { m.Text(fmt.Sprintf("%d  ", int(item.Quantity)), props.Text{Size: 11, Align: consts.Right}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%s  ", item.Unit), props.Text{Size: 11, Align: consts.Right}) })
		})
	}

	// ปิดท้ายตารางด้วยเส้นล่างสุด
	m.Line(1)

	m.Row(5, func() {}) // เว้นบรรทัดหลังตาราง

	// 7. หมายเหตุ
	m.Row(5, func() {
		// หมายเหตุ (ซ้าย)
		m.Col(6, func() {
			m.Text("หมายเหตุ", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#E51C23")})
			m.Text("ขอความกรุณาส่งสินค้าภายในเวลาทำการของร้านเท่านั้น", props.Text{Size: 11, Top: 5})
		})
	})

	// 8. นำออกเป็น Byte Array
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate PDF: %v", err)
	}

	return buf.Bytes(), nil
}

// --------------------------------------------------------

func hexToColor(hex string) color.Color {
	var r, g, b uint8
	// ตัดเครื่องหมาย # ออก
	if len(hex) > 0 && hex[0] == '#' {
		hex = hex[1:]
	}
	// แปลงรหัสฐาน 16 ให้เป็น RGB
	if len(hex) == 6 {
		fmt.Sscanf(hex, "%02x%02x%02x", &r, &g, &b)
	}
	// ส่งค่ากลับเป็น struct สีของ Maroto
	return color.Color{Red: int(r), Green: int(g), Blue: int(b)}
}
