package pos

import (
	"context"
	"fmt"
	"math"
	"os"
	"strings"

	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

// GenerateSaleOrderPDF สร้างไฟล์ PDF บิลขาย / ใบส่งของ / ใบเสร็จรับเงิน ตามดีไซน์ต้นฉบับ
func (s *salesHistoryService) GenerateSaleOrderPDF(ctx context.Context, identifier string, customTitle string) ([]byte, error) {
	// 1. ดึงข้อมูล SaleOrder จาก DB
	order, err := s.salesHistoryRepo.GetSaleHistoryByID(identifier)
	if err != nil {
		return nil, fmt.Errorf("could not get sale order: %w", err)
	}

	// 2. ดึงข้อมูลการตั้งค่าร้านค้า (CompanySetting)
	companySetting, _ := s.salesHistoryRepo.GetCompanySetting(ctx)

	companyName := "เจ.เจ อะไหล่ (หนองสาหร่าย)"
	companyAddress := "51 ม.20 ต.หนองสาหร่าย อ.ปากช่อง จ.นครราชสีมา 30130"
	companyPhone := "096-7985115"
	logoURL := ""

	if companySetting != nil {
		if companySetting.CompanyName != "" {
			companyName = companySetting.CompanyName
		}
		if companySetting.Address != "" {
			companyAddress = companySetting.Address
		}
		if companySetting.PhoneNumber != "" {
			companyPhone = companySetting.PhoneNumber
		}
		if companySetting.LogoURL != "" {
			logoURL = companySetting.LogoURL
		}
	}

	// 3. กำหนดหัวข้อเอกสาร (Document Title)
	docTitle := customTitle
	if docTitle == "" {
		if order.PaymentMethodID != nil && *order.PaymentMethodID == 3 {
			docTitle = "ใบส่งของชั่วคราว/\nใบเสนอราคา"
		} else {
			docTitle = "ใบเสร็จรับเงิน/\nบิลเงินสด"
		}
	}

	// 4. เริ่มสร้าง PDF ด้วย Maroto A4 Portrait
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(12, 14, 12)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	// วันที่และเวลา
	createdTime := order.CreatedAt
	dateStr := createdTime.Format("02/01/2006")
	timeStr := createdTime.Format("15:04:05")

	// รูปแบบการชำระเงิน และ เครดิต
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

	creditTermStr := "เงินสด"
	if order.DueDate != nil {
		days := int(order.DueDate.Sub(order.CreatedAt).Hours() / 24)
		if days > 0 {
			creditTermStr = fmt.Sprintf("เครดิต %d วัน", days)
		} else {
			creditTermStr = fmt.Sprintf("ครบกำหนด %s", order.DueDate.Format("02/01/2006"))
		}
	} else if order.PaymentMethodID != nil && *order.PaymentMethodID == 3 {
		creditTermStr = "เครดิต 90 วัน"
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

	// พนักงานขาย
	salesStaff := "พนักงานขาย"
	if order.CreatedBy != nil && order.CreatedBy.FirstName != "" {
		salesStaff = fmt.Sprintf("%s %s", order.CreatedBy.FirstName, order.CreatedBy.LastName)
	}

	primaryRed := hexToColor("#E51C23")
	darkColor := hexToColor("#1C1B1B")
	grayColor := hexToColor("#5F5E5E")

	// ==========================================
	// 5. ส่วนหัวเอกสาร (Header)
	// ==========================================
	m.Row(24, func() {
		// ฝั่งซ้าย (Col 4.5): โลโก้ + ข้อมูลร้าน
		m.Col(4, func() {
			if logoURL != "" {
				if _, err := os.Stat(logoURL); err == nil {
					_ = m.FileImage(logoURL, props.Rect{
						Percent: 70,
						Center:  false,
					})
				}
			}
			m.Text(companyName, props.Text{
				Size:  12,
				Style: consts.Bold,
				Color: darkColor,
			})
			m.Text(companyAddress, props.Text{
				Size:  9,
				Top:   4.5,
				Color: grayColor,
			})
			m.Text(fmt.Sprintf("โทร: %s", companyPhone), props.Text{
				Size:  9,
				Top:   8.5,
				Color: grayColor,
			})
		})

		// ตรงกลาง (Col 4): กล่องชื่อเอกสาร (Title Box)
		m.Col(4, func() {
			titleLines := strings.Split(docTitle, "\n")
			topOffset := 2.5
			if len(titleLines) == 1 {
				topOffset = 5.0
			}
			for _, line := range titleLines {
				m.Text(line, props.Text{
					Size:  13,
					Style: consts.Bold,
					Align: consts.Center,
					Top:   topOffset,
					Color: darkColor,
				})
				topOffset += 5.5
			}
		})

		// ฝั่งขวา (Col 4): เลขที่เอกสาร, วันที่, ระยะเครดิต, ประเภทชำระเงิน
		m.Col(4, func() {
			m.Text(fmt.Sprintf("เลขที่ : %s", order.OrderNumber), props.Text{
				Size:  9,
				Style: consts.Bold,
				Align: consts.Right,
				Top:   0,
			})
			m.Text(fmt.Sprintf("วันที่ : %s  เวลา : %s", dateStr, timeStr), props.Text{
				Size:  9,
				Align: consts.Right,
				Top:   4.5,
			})
			m.Text(fmt.Sprintf("ระยะเครดิต : %s", creditTermStr), props.Text{
				Size:  9,
				Align: consts.Right,
				Top:   8.5,
			})
			m.Text(fmt.Sprintf("ประเภทชำระเงิน : %s", paymentMethodStr), props.Text{
				Size:  9,
				Align: consts.Right,
				Top:   12.5,
			})
		})
	})

	m.Row(2, func() {})
	m.Line(0.8)
	m.Row(1, func() {})

	// ==========================================
	// 6. ข้อมูลลูกค้า (Customer Section)
	// ==========================================
	m.Row(14, func() {
		m.Col(12, func() {
			m.Text(fmt.Sprintf("ลูกค้า:  %s", custName), props.Text{
				Size:  9,
				Style: consts.Bold,
				Top:   0,
			})
			m.Text(fmt.Sprintf("ที่อยู่:  %s", custAddress), props.Text{
				Size: 9,
				Top:  4.2,
			})
			m.Text(fmt.Sprintf("โทรศัพท์:  %s", custPhone), props.Text{
				Size: 9,
				Top:  8.4,
			})
		})
	})

	m.Row(1, func() {})
	m.Line(0.5)
	m.Row(1, func() {})

	// ==========================================
	// 7. ข้อมูลร้าน & พนักงานขาย
	// ==========================================
	m.Row(5, func() {
		m.Col(6, func() {
			m.Text(fmt.Sprintf("โทรศัพท์: %s", companyPhone), props.Text{
				Size: 9,
			})
		})
		m.Col(6, func() {
			m.Text(fmt.Sprintf("พนักงานขาย: %s", salesStaff), props.Text{
				Size: 9,
			})
		})
	})

	m.Row(1, func() {})
	m.Line(0.8)

	// ==========================================
	// 8. หัวตารางสินค้า (Table Header)
	// ==========================================
	m.Row(7, func() {
		m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Top: 1}) })
		m.Col(2, func() { m.Text("รหัสสินค้า", props.Text{Size: 9, Style: consts.Bold, Align: consts.Left, Top: 1}) })
		m.Col(3, func() { m.Text("รายการ", props.Text{Size: 9, Style: consts.Bold, Align: consts.Left, Top: 1}) })
		m.Col(1, func() { m.Text("จำนวน", props.Text{Size: 9, Style: consts.Bold, Align: consts.Right, Top: 1}) })
		m.Col(1, func() { m.Text("แถม", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Top: 1}) })
		m.Col(1, func() { m.Text("หน่วยนับ", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Top: 1}) })
		m.Col(1, func() { m.Text("ราคา", props.Text{Size: 9, Style: consts.Bold, Align: consts.Right, Top: 1}) })
		m.Col(1, func() { m.Text("ส่วนลด", props.Text{Size: 9, Style: consts.Bold, Align: consts.Right, Top: 1}) })
		m.Col(1, func() { m.Text("มูลค่ารวม", props.Text{Size: 9, Style: consts.Bold, Align: consts.Right, Top: 1}) })
	})
	m.Line(0.8)

	// ==========================================
	// 9. รายการสินค้า (Table Items)
	// ==========================================
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
			m.Col(1, func() {
				m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 9, Align: consts.Center, Top: 1})
			})
			m.Col(2, func() {
				m.Text(itemPartNumber, props.Text{Size: 9, Align: consts.Left, Top: 1})
			})
			m.Col(3, func() {
				m.Text(item.ProductName, props.Text{Size: 9, Align: consts.Left, Top: 1})
			})
			m.Col(1, func() {
				m.Text(fmt.Sprintf("%.2f", float64(item.Qty)), props.Text{Size: 9, Align: consts.Right, Top: 1})
			})
			m.Col(1, func() {
				m.Text("0", props.Text{Size: 9, Align: consts.Center, Top: 1})
			})
			m.Col(1, func() {
				m.Text(itemUnit, props.Text{Size: 9, Align: consts.Center, Top: 1})
			})
			m.Col(1, func() {
				m.Text(fmt.Sprintf("%.2f", item.UnitPrice), props.Text{Size: 9, Align: consts.Right, Top: 1})
			})
			m.Col(1, func() {
				m.Text(fmt.Sprintf("%.2f", itemDiscount), props.Text{Size: 9, Align: consts.Right, Top: 1})
			})
			m.Col(1, func() {
				m.Text(fmt.Sprintf("%.2f", itemTotal), props.Text{Size: 9, Style: consts.Bold, Align: consts.Right, Top: 1})
			})
		})
	}

	// วาดเส้นปิดตาราง
	m.Line(0.8)
	m.Row(4, func() {})

	// ==========================================
	// 10. สรุปท้ายบิล & หมายเหตุ (Summary Box)
	// ==========================================
	m.Line(0.6)
	m.Row(34, func() {
		// ฝั่งซ้าย (7 คอลัมน์): เงื่อนไข + กล่องโอนเงิน
		m.Col(7, func() {
			m.Text("1. สินค้าตามใบส่งของนี้ หากมีการขาดตกบกพร่องประการใด โปรดแจ้งให้ทางร้านทราบ", props.Text{
				Size: 8,
				Top:  2,
			})
			m.Text("   ภายใน 7 วัน มิฉะนั้นทางร้านฯ จะไม่รับผิดชอบความเสียหายใดๆ ทั้งสิ้น", props.Text{
				Size: 8,
				Top:  5.5,
			})

			// กล่องข้อมูลสำหรับโอนเงิน
			m.Text("ข้อมูลสำหรับโอนเงินผ่านธนาคาร", props.Text{
				Size:  8.5,
				Style: consts.Bold,
				Color: primaryRed,
				Top:   12,
			})
			m.Text("โอนเงินเข้าบัญชี : เจ.เจ อะไหล่ ธนาคารกรุงไทย เลขที่บัญชี XXX-X-XXXXX-X", props.Text{
				Size: 8,
				Top:  16,
			})
		})

		// ฝั่งขวา (5 คอลัมน์): ตัวเลขสรุปยอด
		m.Col(5, func() {
			// ลดท้ายบิล
			m.Text("ลดท้ายบิล", props.Text{
				Size:  8.5,
				Align: consts.Left,
				Top:   2,
			})
			m.Text(fmt.Sprintf("%.2f", order.DiscountAmount), props.Text{
				Size:  8.5,
				Align: consts.Right,
				Top:   2,
			})

			// มูลค่าสินค้า
			m.Text("มูลค่าสินค้า", props.Text{
				Size:  8.5,
				Align: consts.Left,
				Top:   6.5,
			})
			m.Text(fmt.Sprintf("%.2f", order.Subtotal), props.Text{
				Size:  8.5,
				Align: consts.Right,
				Top:   6.5,
			})

			// รวม
			m.Text("รวม", props.Text{
				Size:  8.5,
				Align: consts.Left,
				Top:   11.0,
			})
			m.Text(fmt.Sprintf("%.2f", order.Subtotal-order.DiscountAmount), props.Text{
				Size:  8.5,
				Align: consts.Right,
				Top:   11.0,
			})

			// มูลค่าสุทธิ
			m.Text("มูลค่าสุทธิ", props.Text{
				Size:  11,
				Style: consts.Bold,
				Color: darkColor,
				Align: consts.Left,
				Top:   18.0,
			})
			m.Text(fmt.Sprintf("฿%.2f", order.TotalAmount), props.Text{
				Size:  15,
				Style: consts.Bold,
				Color: darkColor,
				Align: consts.Right,
				Top:   17.0,
			})

			// ตัวอักษรไทยบาทถ้วน
			thaiText := ThaiBahtText(order.TotalAmount)
			m.Text(fmt.Sprintf("| — %s — |", thaiText), props.Text{
				Size:  7.5,
				Align: consts.Right,
				Top:   25.0,
				Color: grayColor,
			})
		})
	})
	m.Line(0.6)

	m.Row(4, func() {})

	// ==========================================
	// 11. Footer สิ้นสุดเอกสาร
	// ==========================================
	m.Row(6, func() {
		m.Col(12, func() {
			m.Text(fmt.Sprintf("สิ้นสุดเอกสาร - ประมวลผลโดยระบบบริหารจัดการ %s", companyName), props.Text{
				Size:  7.5,
				Align: consts.Center,
				Color: grayColor,
				Top:   2,
			})
		})
	})

	// 12. ส่งออกไฟล์เป็น Byte Array
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate receipt PDF: %w", err)
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
