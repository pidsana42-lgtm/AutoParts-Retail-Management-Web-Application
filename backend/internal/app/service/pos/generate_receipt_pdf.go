package pos

import (
	"context"
	"fmt"
	"math"
	"strings"

	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

// GenerateSaleOrderPDF สร้างไฟล์ PDF บิลขาย / ใบเสร็จรับเงิน / ใบส่งของ ตามรูปแบบเดียวกับ Purchase Order
func (s *salesHistoryService) GenerateSaleOrderPDF(ctx context.Context, identifier string, customTitle string) ([]byte, error) {
	// 1. ดึงข้อมูลจริงจาก Database
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return nil, fmt.Errorf("could not get sale order: %w", err)
	}

	companyData, err := s.salesHistoryRepo.GetCompanySetting(ctx)
	if err != nil || companyData == nil {
		companyData = nil
	}

	companyName := "เจ.เจ อะไหล่ (หนองสาหร่าย)"
	companyAddress := "51 ม.20 ต.หนองสาหร่าย อ.ปากช่อง จ.นครราชสีมา 30130"
	companyPhone := "096-7985115"
	companyEmail := "-"
	companyTaxID := "-"
	logoURL := ""

	if companyData != nil {
		if companyData.CompanyName != "" {
			companyName = companyData.CompanyName
		}
		if companyData.Address != "" {
			companyAddress = companyData.Address
		}
		if companyData.PhoneNumber != "" {
			companyPhone = companyData.PhoneNumber
		}
		if companyData.Email != "" {
			companyEmail = companyData.Email
		}
		if companyData.TaxIDNumber != "" {
			companyTaxID = companyData.TaxIDNumber
		}
		if companyData.LogoURL != "" {
			logoURL = companyData.LogoURL
		}
	}

	// 2. กำหนดหัวข้อเอกสาร (Document Title)
	docTitle := customTitle
	if docTitle == "" {
		if order.PaymentMethodID != nil && *order.PaymentMethodID == 3 {
			docTitle = "ใบส่งของชั่วคราว"
		} else {
			docTitle = "ใบเสร็จรับเงิน"
		}
	}

	// 3. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	orderDate := order.CreatedAt.Format("02/01/2006 15:04")

	// รูปแบบการชำระเงิน
	paymentMethodStr := "เงินสด"
	if order.PaymentMethod != nil && order.PaymentMethod.MethodName != "" {
		paymentMethodStr = order.PaymentMethod.MethodName
	} else if order.PaymentMethodID != nil {
		switch *order.PaymentMethodID {
		case 1:
			paymentMethodStr = "เงินสด"
		case 2:
			paymentMethodStr = "เงินโอน"
		case 3:
			paymentMethodStr = "เงินเชื่อ"
		}
	}

	// พนักงานขาย
	salesStaff := "พนักงานขาย"
	if order.CreatedBy != nil && order.CreatedBy.FirstName != "" {
		salesStaff = fmt.Sprintf("%s %s", order.CreatedBy.FirstName, order.CreatedBy.LastName)
	}

	// ข้อมูลลูกค้า
	custName := "ลูกค้าทั่วไป"
	if order.Customer.CustomerName != "" {
		custName = order.Customer.CustomerName
		if order.Customer.CustomerType.TypeName != "" {
			custName = fmt.Sprintf("%s (%s)", order.Customer.CustomerName, order.Customer.CustomerType.TypeName)
		}
	} else if order.CustomerNameTemp != nil && *order.CustomerNameTemp != "" {
		custName = *order.CustomerNameTemp
	}

	custAddress := "-"
	if order.CustomerAddressTemp != "" {
		custAddress = order.CustomerAddressTemp
	} else if order.Customer.ShippingAddress != "" {
		custAddress = order.Customer.ShippingAddress
	} else if order.Customer.RegisteredAddress != "" {
		custAddress = order.Customer.RegisteredAddress
	}

	custPhone := "-"
	if order.CustomerPhoneTemp != nil && *order.CustomerPhoneTemp != "" {
		custPhone = *order.CustomerPhoneTemp
	} else if order.Customer.PhoneNumber != "" {
		custPhone = order.Customer.PhoneNumber
	}

	// 4. ส่วนหัวเอกสาร (Header) รูปแบบเดียวกับ Purchase Order
	m.RegisterHeader(func() {
		m.Row(25, func() {
			m.Col(3, func() {
				if logoURL != "" {
					_ = m.FileImage(logoURL, props.Rect{
						Percent: 400,
						Center:  false, // ให้โลโก้ชิดซ้าย
					})
				}
			})
			m.Col(5, func() {}) // ช่องว่างตรงกลาง
			m.Col(4, func() {
				// รองรับการขึ้นบรรทัดใหม่ของ Title ถ้ามี
				titleLines := strings.Split(docTitle, "\n")
				fontSize := 24.0
				if len(titleLines) > 1 {
					fontSize = 18.0
				}
				topOffset := 0.0
				for _, line := range titleLines {
					m.Text(line, props.Text{
						Size:  fontSize,
						Style: consts.Bold,
						Align: consts.Center,
						Color: hexToColor("#E51C23"),
						Top:   topOffset,
					})
					topOffset += 6.5
				}
			})
		})
	})

	m.Row(5, func() {}) // เว้นบรรทัด

	// 5. ข้อมูลบริษัท (ซ้าย) และ ข้อมูลเอกสาร (ขวา)
	m.Row(25, func() {
		// ฝั่งซ้าย: ข้อมูลบริษัท
		m.Col(8, func() {
			m.Text(companyName, props.Text{Size: 12, Style: consts.Bold})
			m.Text(companyAddress, props.Text{Size: 11, Top: 5})
			m.Text(fmt.Sprintf("โทร. %s", companyPhone), props.Text{Size: 11, Top: 10})
			m.Text(fmt.Sprintf("อีเมล %s", companyEmail), props.Text{Size: 11, Top: 15})
			m.Text(fmt.Sprintf("เลขประจำตัวผู้เสียภาษี %s", companyTaxID), props.Text{Size: 11, Top: 20})
		})
		// ฝั่งขวา: หั่นย่อยเป็น 2 คอลัมน์ (Label สีแดง กับ Value)
		m.Col(1, func() {
			m.Text("เลขที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Color: hexToColor("#E51C23")})
			m.Text("วันที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: hexToColor("#E51C23")})
			m.Text("พนักงาน", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 10, Color: hexToColor("#E51C23")})
			m.Text("ชำระโดย", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 15, Color: hexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(order.OrderNumber, props.Text{Size: 11, Align: consts.Left})
			m.Text(orderDate, props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text(salesStaff, props.Text{Size: 11, Align: consts.Left, Top: 10})
			m.Text(paymentMethodStr, props.Text{Size: 11, Align: consts.Left, Top: 15})
		})
	})

	m.Row(5, func() {})

	// 6. ข้อมูลลูกค้า
	m.Row(15, func() {
		m.Col(12, func() {
			m.Text("ลูกค้า", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#E51C23")})
			m.Text(custName, props.Text{Size: 11, Top: 5})
			m.Text(fmt.Sprintf("%s  (โทร. %s)", custAddress, custPhone), props.Text{Size: 11, Top: 10})
		})
	})

	m.Row(5, func() {})

	// 7. สร้างตารางแบบ Manual (เส้นขอบบน ล่าง และรายการสินค้า)
	m.Line(1)

	// หัวตาราง
	m.Row(8, func() {
		m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("รหัสสินค้า", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left}) })
		m.Col(4, func() { m.Text("ชื่อสินค้า", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left}) })
		m.Col(1, func() { m.Text("จำนวน", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right}) })
		m.Col(1, func() { m.Text("หน่วย", props.Text{Size: 11, Style: consts.Bold, Align: consts.Center}) })
		m.Col(1, func() { m.Text("ราคา/หน่วย", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right}) })
		m.Col(1, func() { m.Text("ส่วนลด", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right}) })
		m.Col(1, func() { m.Text("จำนวนเงิน", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right}) })
	})

	m.Line(1)

	// วนลูปข้อมูลสินค้า (Content)
	for i, item := range order.Items {
		itemPartNumber := item.PartNumber
		if itemPartNumber == "" {
			itemPartNumber = "-"
		}
		itemUnit := item.Unit
		if itemUnit == "" {
			itemUnit = "ชิ้น"
		}
		itemDiscount := item.DiscountAmount
		itemTotal := item.Subtotal
		if itemTotal == 0 {
			itemTotal = item.UnitPrice*float64(item.Qty) - itemDiscount
		}

		m.Row(7, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 11, Align: consts.Center}) })
			m.Col(2, func() { m.Text(itemPartNumber, props.Text{Size: 11, Align: consts.Left}) })
			m.Col(4, func() { m.Text(item.ProductName, props.Text{Size: 11, Align: consts.Left}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", item.Qty), props.Text{Size: 11, Align: consts.Right}) })
			m.Col(1, func() { m.Text(itemUnit, props.Text{Size: 11, Align: consts.Center}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", item.UnitPrice), props.Text{Size: 11, Align: consts.Right}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", itemDiscount), props.Text{Size: 11, Align: consts.Right}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", itemTotal), props.Text{Size: 11, Align: consts.Right}) })
		})
	}

	m.Line(1)

	m.Row(5, func() {}) // เว้นบรรทัดหลังตาราง

	// 8. ส่วนสรุปยอด (ขวา) และ หมายเหตุ + คำอ่านภาษาไทย (ซ้าย)
	thaiText := ThaiBahtText(order.TotalAmount)

	var grossTotal float64
	var lineDiscounts float64
	for _, item := range order.Items {
		grossTotal += item.UnitPrice * float64(item.Qty)
		lineDiscounts += item.DiscountAmount
	}
	if grossTotal == 0 {
		grossTotal = order.Subtotal
	}
	billDiscount := order.DiscountAmount
	totalDiscount := lineDiscounts + billDiscount

	m.Row(28, func() {
		// หมายเหตุ (ซ้าย)
		m.Col(6, func() {
			m.Text("หมายเหตุ", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#E51C23")})
			m.Text("1. สินค้าตามใบเสร็จ/ใบส่งของนี้ หากมีข้อผิดพลาดโปรดแจ้งทางร้านภายใน 7 วัน", props.Text{Size: 10, Top: 5})
			m.Text(fmt.Sprintf("จำนวนเงินทั้งสิ้น (ตัวอักษร): %s", thaiText), props.Text{Size: 10, Style: consts.Bold, Top: 11})
		})

		// สรุปยอดเงิน (ขวา)
		m.Col(3, func() {
			m.Text("ราคารวมสินค้า", props.Text{Size: 11, Align: consts.Left})
			m.Text("ส่วนลดท้ายบิล", props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text("ส่วนลดรวมทั้งสิ้น", props.Text{Size: 11, Align: consts.Left, Top: 10})
			m.Text("จำนวนเงินสุทธิ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 16, Color: hexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(fmt.Sprintf("฿%.2f", grossTotal), props.Text{Size: 11, Align: consts.Right})
			m.Text(fmt.Sprintf("฿%.2f", billDiscount), props.Text{Size: 11, Align: consts.Right, Top: 5})
			m.Text(fmt.Sprintf("฿%.2f", totalDiscount), props.Text{Size: 11, Align: consts.Right, Top: 10})
			m.Text(fmt.Sprintf("฿%.2f", order.TotalAmount), props.Text{Size: 12, Style: consts.Bold, Align: consts.Right, Top: 16, Color: hexToColor("#E51C23")})
		})
	})

	// 9. นำออกเป็น Byte Array
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

// -----------------------------------------------------------------------------
// Helper: แปลงจำนวนเงินเป็นตัวหนังสือภาษาไทย (Thai Baht Text)
// -----------------------------------------------------------------------------

// ThaiBahtText แปลง float64 เป็นคำอ่านภาษาไทย เช่น 1653.00 -> "หนึ่งพันหกร้อยห้าสิบสามบาทถ้วน"
func ThaiBahtText(amount float64) string {
	if amount == 0 {
		return "ศูนย์บาทถ้วน"
	}

	negative := false
	if amount < 0 {
		negative = true
		amount = -amount
	}

	amount = math.Round(amount*100) / 100
	intPart := int64(amount)
	satangPart := int64(math.Round((amount - float64(intPart)) * 100))

	var result string
	if negative {
		result += "ลบ"
	}

	if intPart > 0 {
		result += convertThaiNumber(intPart) + "บาท"
	}

	if satangPart == 0 {
		result += "ถ้วน"
	} else {
		if intPart == 0 {
			result += convertThaiNumber(satangPart) + "สตางค์"
		} else {
			result += convertThaiNumber(satangPart) + "สตางค์"
		}
	}

	return result
}

func convertThaiNumber(n int64) string {
	if n == 0 {
		return "ศูนย์"
	}

	if n >= 1000000 {
		millions := n / 1000000
		remainder := n % 1000000
		millionsText := convertThaiNumber(millions) + "ล้าน"
		if remainder > 0 {
			if remainder >= 1000000 {
				return millionsText + convertThaiNumber(remainder)
			}
			return millionsText + convertUnderMillion(remainder)
		}
		return millionsText
	}

	return convertUnderMillion(n)
}

func convertUnderMillion(n int64) string {
	digits := []string{"", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"}
	positions := []string{"", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"}

	str := fmt.Sprintf("%d", n)
	length := len(str)
	var result string

	for i, ch := range str {
		digit := int(ch - '0')
		pos := length - i - 1

		if digit == 0 {
			continue
		}

		if pos == 0 {
			if digit == 1 && length > 1 {
				result += "เอ็ด"
			} else {
				result += digits[digit]
			}
		} else if pos == 1 {
			if digit == 1 {
				result += "สิบ"
			} else if digit == 2 {
				result += "ยี่สิบ"
			} else {
				result += digits[digit] + "สิบ"
			}
		} else {
			result += digits[digit] + positions[pos]
		}
	}
	return result
}

func hexToColor(hex string) color.Color {
	var r, g, b uint8
	if len(hex) > 0 && hex[0] == '#' {
		hex = hex[1:]
	}
	if len(hex) == 6 {
		fmt.Sscanf(hex, "%02x%02x%02x", &r, &g, &b)
	}
	return color.Color{Red: int(r), Green: int(g), Blue: int(b)}
}
