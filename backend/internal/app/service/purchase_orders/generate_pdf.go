package purchaseorders

import (
	"fmt"
	"context"
	
	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

func (s *purchaseOrderService) GeneratePOPDF(ctx context.Context, poID uint) ([]byte, error) {
	// 1. ดึงข้อมูลจริงจาก Database
	poData, err := s.poRepository.GetPOForPDF(ctx, poID)
	if err != nil {
		return nil, fmt.Errorf("could not get PO data: %v", err)
	}

	// 2. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	// 3. ส่วนหัวเอกสาร
	m.RegisterHeader(func() {
		m.Row(20, func() {
			m.Col(12, func() {
				m.Text("ใบสั่งซื้อ (Purchase Order)", props.Text{
					Top:   5,
					Style: consts.Bold,
					Size:  20,
					Align: consts.Center,
				})
			})
		})
	})

	// 4. ข้อมูลทั่วไป (ดึงจาก poData)
	// สมมติว่าเก็บวันที่สร้างไว้ใน CreatedAt
	poDate := poData.CreatedAt.Format("02/01/2006") 
	
	m.Row(10, func() {
		m.Col(6, func() {
			m.Text(fmt.Sprintf("เลขที่ใบสั่งซื้อ: %v", poData.PO_number), props.Text{Size: 14})
		})
		m.Col(6, func() {
			m.Text(fmt.Sprintf("วันที่: %s", poDate), props.Text{Size: 14, Align: consts.Right})
		})
	})

	m.Row(10, func() {
		m.Col(12, func() {
			// สมมติว่าชื่อ Supplier เก็บไว้ในฟิลด์ SupplierName หรือต้องดึงผ่าน Relation
			supplierName := poData.Supplier.SupplierName;
			m.Text(fmt.Sprintf("ผู้จัดจำหน่าย: %s", supplierName), props.Text{Size: 14})
		})
	})
	
	m.Row(5, func() {}) // เว้นบรรทัด

	// 5. จัดเตรียมข้อมูลตารางจากฐานข้อมูล
	headers := []string{"ลำดับ", "รายการสินค้า", "จำนวน", "ราคา/หน่วย", "ราคารวม"}
	var contents [][]string

	// วนลูปดึงข้อมูลจาก Items ใน poData
	for i, item := range poData.PO_Items {
		contents = append(contents, []string{
			fmt.Sprintf("%d", i+1), // ลำดับที่
			item.Product_name_snapshot,       // ชื่อสินค้า
			fmt.Sprintf("%d", int(item.Quantity)),        // จำนวน
			fmt.Sprintf("%.2f", item.UnitPrice),                // ราคาต่อหน่วย
			fmt.Sprintf("%.2f", float64(item.Quantity)*item.UnitPrice), // ราคารวมของรายการนี้
		})
	}

	// 6. สร้างตาราง
	m.TableList(headers, contents, props.TableList{
		HeaderProp: props.TableListContent{
			Size:      12,
			GridSizes: []uint{1, 5, 2, 2, 2},
		},
		ContentProp: props.TableListContent{
			Size:      12,
			GridSizes: []uint{1, 5, 2, 2, 2},
		},
		Align:                consts.Center,
		AlternatedBackground: &color.Color{Red: 240, Green: 240, Blue: 240},
		HeaderContentSpace:   1,
		Line:                 true,
	})

	// 7. ส่วนสรุปยอด (ดึงจาก TotalAmount ของ PO)
	m.Row(15, func() {})
	m.Row(10, func() {
		m.Col(8, func() {}) 
		m.Col(4, func() {
			m.Text(fmt.Sprintf("ยอดรวมทั้งสิ้น: %.2f บาท", poData.Total_amount), props.Text{
				Size:  14,
				Style: consts.Bold,
				Align: consts.Right,
			})
		})
	})

	// 8. นำออกเป็น Byte Array
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate PDF: %v", err)
	}

	return buf.Bytes(), nil
}