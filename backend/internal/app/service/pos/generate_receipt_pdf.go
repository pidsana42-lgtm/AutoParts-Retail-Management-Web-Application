package pos

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"backend/internal/app/entity"

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
	} else if strings.Contains(docTitle, "ชำระหนี้") {
		docTitle = "ใบเสร็จรับเงิน\n(ชำระหนี้)"
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

	// 7. สร้างตารางแบบ Manual
	isDebtSettlement := strings.Contains(docTitle, "ชำระหนี้")

	if isDebtSettlement {
		// ตารางรายการบิลที่ชำระหนี้ (8 Columns Matching Specification Screenshot)
		m.Line(1)

		// หัวตาราง
		m.Row(8, func() {
			m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
			m.Col(2, func() { m.Text("เลขที่เอกสาร", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
			m.Col(1, func() { m.Text("วันที่", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
			m.Col(2, func() { m.Text("ยอดตามบิล", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
			m.Col(2, func() { m.Text("ชำระแล้ว", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
			m.Col(2, func() { m.Text("ยอดค้างชำระ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
			m.Col(1, func() { m.Text("ชำระครั้งนี้", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
			m.Col(1, func() { m.Text("คงเหลือ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
		})

		m.Line(1)

		originalDebt := order.TotalAmount
		paidAmount := order.PaidAmount
		if paidAmount == 0 && order.ReceivedAmount > 0 {
			paidAmount = order.ReceivedAmount
		}
		if paidAmount == 0 && order.PaymentStatus == "paid" {
			paidAmount = order.TotalAmount
		}
		balanceDue := order.BalanceDue
		if balanceDue == 0 && order.PaymentStatus == "unpaid" {
			balanceDue = order.TotalAmount
		}

		paidBefore := (originalDebt - balanceDue) - paidAmount
		if paidBefore < 0 {
			paidBefore = 0
		}
		balanceBefore := originalDebt - paidBefore
		if balanceBefore < 0 {
			balanceBefore = 0
		}
		amountPaidThisTime := paidAmount
		balanceAfter := balanceDue

		orderDateThai := formatThaiDate(order.CreatedAt)

		m.Row(7, func() {
			m.Col(1, func() { m.Text("1", props.Text{Size: 10, Align: consts.Center}) })
			m.Col(2, func() { m.Text(order.OrderNumber, props.Text{Size: 10, Align: consts.Left}) })
			m.Col(1, func() { m.Text(orderDateThai, props.Text{Size: 9.5, Align: consts.Center}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", originalDebt), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", paidBefore), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", balanceBefore), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", amountPaidThisTime), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", balanceAfter), props.Text{Size: 10, Align: consts.Right}) })
		})

		m.Line(1)

		m.Row(5, func() {})

		// 8. ส่วนสรุปยอด (ขวา) และ หมายเหตุ + คำอ่านภาษาไทย (ซ้าย)
		thaiText := ThaiBahtText(amountPaidThisTime)

		m.Row(28, func() {
			// หมายเหตุ (ซ้าย)
			m.Col(6, func() {
				m.Text("หมายเหตุ", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#E51C23")})
				m.Text("1. ใบเสร็จรับเงินนี้จะสมบูรณ์เมื่อทางร้านได้รับชำระเงินเรียบร้อยแล้ว", props.Text{Size: 10, Top: 5})
				m.Text(fmt.Sprintf("จำนวนเงินที่ชำระ (ตัวอักษร): %s", thaiText), props.Text{Size: 10, Style: consts.Bold, Top: 11})
			})

			// สรุปยอดเงิน (ขวา)
			m.Col(3, func() {
				m.Text("ยอดค้างก่อนจ่าย", props.Text{Size: 11, Align: consts.Left})
				m.Text("ยอดคงเหลือหลังชำระ", props.Text{Size: 11, Align: consts.Left, Top: 5})
				m.Text("ยอดชำระครั้งนี้ทั้งสิ้น", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 12, Color: hexToColor("#E51C23")})
			})
			m.Col(3, func() {
				m.Text(fmt.Sprintf("฿%.2f", balanceBefore), props.Text{Size: 11, Align: consts.Right})
				m.Text(fmt.Sprintf("฿%.2f", balanceAfter), props.Text{Size: 11, Align: consts.Right, Top: 5})
				m.Text(fmt.Sprintf("฿%.2f", amountPaidThisTime), props.Text{Size: 12, Style: consts.Bold, Align: consts.Right, Top: 12, Color: hexToColor("#E51C23")})
			})
		})
	} else {
		// สร้างตารางแบบ Manual (เส้นขอบบน ล่าง และรายการสินค้า)
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

			specsLine := getItemSubDetails(item)

			rowHeight := 7.5
			if specsLine != "" {
				rowHeight = 11.0
			}

			m.Row(rowHeight, func() {
				m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 10, Align: consts.Center, Top: 0.5}) })
				m.Col(2, func() { m.Text(itemPartNumber, props.Text{Size: 10, Align: consts.Left, Top: 0.5}) })
				m.Col(4, func() {
					m.Text(item.ProductName, props.Text{Size: 10, Style: consts.Bold, Align: consts.Left, Top: 0.5})
					if specsLine != "" {
						m.Text(specsLine, props.Text{Size: 8.5, Top: 4.5, Color: hexToColor("#4B5563"), Align: consts.Left})
					}
				})
				m.Col(1, func() { m.Text(fmt.Sprintf("%d", item.Qty), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
				m.Col(1, func() { m.Text(itemUnit, props.Text{Size: 10, Align: consts.Center, Top: 0.5}) })
				m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", item.UnitPrice), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
				m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", itemDiscount), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
				m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", itemTotal), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
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
				m.Text("1. สินค้าตามใบส่งของนี้ หากมีการขาดตกบกพร่องประการใด โปรดแจ้งให้ทางร้านฯ ทราบ", props.Text{
					Size: 10,
					Top:  5,
				})
				m.Text("ภายใน 7 วัน มิฉะนั้นทางร้านฯ จะไม่รับผิดชอบความเสียหายใดๆ ทั้งสิ้น", props.Text{
					Size: 10,
					Top:  9.5,
				})
				m.Text(fmt.Sprintf("จำนวนเงินทั้งสิ้น (ตัวอักษร): %s", thaiText), props.Text{
					Size:  10,
					Style: consts.Bold,
					Top:   15.5,
				})
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
	}

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

// getItemSubDetails รวบรวมข้อมูล แบรนด์, เกรด และรุ่นรถที่รองรับ
func getItemSubDetails(item entity.SaleOrderItem) string {
	var brands []string
	brandMap := make(map[string]bool)
	var models []string
	modelMap := make(map[string]bool)

	for _, m := range item.Product.Models {
		if m.Brand != nil && m.Brand.Brand_Name != "" {
			bName := strings.TrimSpace(m.Brand.Brand_Name)
			if !brandMap[bName] {
				brandMap[bName] = true
				brands = append(brands, bName)
			}
		}
		if m.Model_Name != "" {
			mName := strings.TrimSpace(m.Model_Name)
			if !modelMap[mName] {
				modelMap[mName] = true
				models = append(models, mName)
			}
		}
	}

	var gradeName string
	if item.Product.Grade != nil && item.Product.Grade.Grade_Name != "" {
		gradeName = strings.TrimSpace(item.Product.Grade.Grade_Name)
	}

	// บรรทัดคุณสมบัติสินค้า (แบรนด์ / เกรด / รุ่นรถ)
	var specParts []string
	if len(brands) > 0 {
		specParts = append(specParts, fmt.Sprintf("แบรนด์: %s", strings.Join(brands, ", ")))
	}
	if gradeName != "" {
		specParts = append(specParts, fmt.Sprintf("เกรด: %s", gradeName))
	}
	if len(models) > 0 {
		specParts = append(specParts, fmt.Sprintf("รุ่นรถ: %s", strings.Join(models, ", ")))
	}

	return strings.Join(specParts, "  |  ")
}

// GenerateDebtRepaymentReceiptPDF สร้างไฟล์ PDF ใบเสร็จรับเงิน (ชำระหนี้) ตามโครงสร้างตาราง 8 คอลัมน์
func (s *paymentService) GenerateDebtRepaymentReceiptPDF(ctx context.Context, identifier string) ([]byte, error) {
	// 1. ค้นหารายการ Repayment
	var repayments []entity.PaymentRepayment

	id, err := strconv.ParseUint(identifier, 10, 64)
	if err == nil && id > 0 {
		singleRepayment, err := s.paymentRepo.GetRepaymentByID(uint(id))
		if err == nil && singleRepayment != nil && singleRepayment.ID > 0 {
			if singleRepayment.ReceiptNumber != "" {
				sameReceiptRepayments, err := s.paymentRepo.GetRepaymentsByReceiptNumber(singleRepayment.ReceiptNumber)
				if err == nil && len(sameReceiptRepayments) > 0 {
					repayments = sameReceiptRepayments
				} else {
					repayments = []entity.PaymentRepayment{*singleRepayment}
				}
			} else {
				repayments = []entity.PaymentRepayment{*singleRepayment}
			}
		}
	}

	if len(repayments) == 0 {
		sameReceiptRepayments, err := s.paymentRepo.GetRepaymentsByReceiptNumber(identifier)
		if err == nil && len(sameReceiptRepayments) > 0 {
			repayments = sameReceiptRepayments
		}
	}

	if len(repayments) == 0 {
		return nil, fmt.Errorf("could not find repayment receipt with identifier: %s", identifier)
	}

	firstRepayment := repayments[0]

	// 2. ดึงข้อมูลบริษัท
	companyData, err := s.paymentRepo.GetCompanySetting(ctx)
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

	// 3. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	paidDate := firstRepayment.CreatedAt.Format("02/01/2006 15:04")
	if firstRepayment.PaidAt != nil {
		paidDate = firstRepayment.PaidAt.Format("02/01/2006 15:04")
	}

	// รูปแบบการชำระเงิน
	paymentMethodStr := "เงินสด"
	if firstRepayment.PaymentMethod.MethodName != "" {
		paymentMethodStr = firstRepayment.PaymentMethod.MethodName
	}

	// พนักงานผู้รับเงิน
	salesStaff := "พนักงานผู้รับเงิน"
	if firstRepayment.RecordedBy.FirstName != "" || firstRepayment.RecordedBy.LastName != "" {
		salesStaff = fmt.Sprintf("%s %s", firstRepayment.RecordedBy.FirstName, firstRepayment.RecordedBy.LastName)
	} else if firstRepayment.RecordedBy.Username != "" {
		salesStaff = firstRepayment.RecordedBy.Username
	}

	// ข้อมูลลูกค้า
	order := firstRepayment.Order
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

	// 4. ส่วนหัวเอกสาร (Header)
	m.RegisterHeader(func() {
		m.Row(25, func() {
			m.Col(3, func() {
				if logoURL != "" {
					_ = m.FileImage(logoURL, props.Rect{
						Percent: 400,
						Center:  false,
					})
				}
			})
			m.Col(5, func() {})
			m.Col(4, func() {
				m.Text("ใบเสร็จรับเงิน", props.Text{
					Size:  22.0,
					Style: consts.Bold,
					Align: consts.Center,
					Color: hexToColor("#E51C23"),
					Top:   0,
				})
				m.Text("(ชำระหนี้)", props.Text{
					Size:  16.0,
					Style: consts.Bold,
					Align: consts.Center,
					Color: hexToColor("#E51C23"),
					Top:   7.0,
				})
			})
		})
	})

	m.Row(5, func() {})

	// 5. ข้อมูลบริษัท (ซ้าย) และ ข้อมูลเอกสาร (ขวา)
	m.Row(25, func() {
		m.Col(8, func() {
			m.Text(companyName, props.Text{Size: 12, Style: consts.Bold})
			m.Text(companyAddress, props.Text{Size: 11, Top: 5})
			m.Text(fmt.Sprintf("โทร. %s", companyPhone), props.Text{Size: 11, Top: 10})
			m.Text(fmt.Sprintf("อีเมล %s", companyEmail), props.Text{Size: 11, Top: 15})
			m.Text(fmt.Sprintf("เลขประจำตัวผู้เสียภาษี %s", companyTaxID), props.Text{Size: 11, Top: 20})
		})
		m.Col(1, func() {
			m.Text("เลขที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Color: hexToColor("#E51C23")})
			m.Text("วันที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: hexToColor("#E51C23")})
			m.Text("พนักงาน", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 10, Color: hexToColor("#E51C23")})
			m.Text("ชำระโดย", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 15, Color: hexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(firstRepayment.ReceiptNumber, props.Text{Size: 11, Align: consts.Left})
			m.Text(paidDate, props.Text{Size: 11, Align: consts.Left, Top: 5})
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

	// 7. ตารางรายการบิลที่ชำระหนี้ (8 Columns Matching Specification Screenshot)
	m.Line(1)

	// หัวตาราง
	m.Row(8, func() {
		m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("เลขที่เอกสาร", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
		m.Col(1, func() { m.Text("วันที่", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("ยอดตามบิล", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
		m.Col(2, func() { m.Text("ชำระแล้ว", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
		m.Col(2, func() { m.Text("ยอดค้างชำระ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
		m.Col(1, func() { m.Text("ชำระครั้งนี้", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
		m.Col(1, func() { m.Text("คงเหลือ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Right}) })
	})

	m.Line(1)

	var totalBalanceBefore float64
	var totalPaidThisTime float64
	var totalRemainingBalance float64

	// วนลูปแสดงข้อมูลบิล
	for i, r := range repayments {
		orderDate := formatThaiDate(r.Order.CreatedAt)
		originalDebt := r.Order.TotalAmount
		paidBefore, _ := s.paymentRepo.GetPreviousRepaymentsSum(r.OrderID, r.ID)
		balanceBefore := originalDebt - paidBefore
		if balanceBefore < 0 {
			balanceBefore = 0
		}
		amountPaid := r.AmountPaid
		balanceAfter := balanceBefore - amountPaid
		if balanceAfter < 0 {
			balanceAfter = 0
		}

		totalBalanceBefore += balanceBefore
		totalPaidThisTime += amountPaid
		totalRemainingBalance += balanceAfter

		m.Row(7, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 10, Align: consts.Center}) })
			m.Col(2, func() { m.Text(r.Order.OrderNumber, props.Text{Size: 10, Align: consts.Left}) })
			m.Col(1, func() { m.Text(orderDate, props.Text{Size: 9.5, Align: consts.Center}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", originalDebt), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", paidBefore), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", balanceBefore), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", amountPaid), props.Text{Size: 10, Align: consts.Right}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", balanceAfter), props.Text{Size: 10, Align: consts.Right}) })
		})
	}

	m.Line(1)

	m.Row(5, func() {})

	// 8. ส่วนสรุปยอด (ขวา) และ หมายเหตุ + คำอ่านภาษาไทย (ซ้าย)
	thaiText := ThaiBahtText(totalPaidThisTime)

	m.Row(28, func() {
		// หมายเหตุ (ซ้าย)
		m.Col(6, func() {
			m.Text("หมายเหตุ", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#E51C23")})
			m.Text("1. ใบเสร็จรับเงินนี้จะสมบูรณ์เมื่อทางร้านได้รับชำระเงินเรียบร้อยแล้ว", props.Text{Size: 10, Top: 5})
			m.Text(fmt.Sprintf("จำนวนเงินที่ชำระ (ตัวอักษร): %s", thaiText), props.Text{Size: 10, Style: consts.Bold, Top: 11})
		})

		// สรุปยอดเงิน (ขวา)
		m.Col(3, func() {
			m.Text("ยอดค้างก่อนจ่าย", props.Text{Size: 11, Align: consts.Left})
			m.Text("ยอดคงเหลือหลังชำระ", props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text("ยอดชำระครั้งนี้ทั้งสิ้น", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 12, Color: hexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(fmt.Sprintf("฿%.2f", totalBalanceBefore), props.Text{Size: 11, Align: consts.Right})
			m.Text(fmt.Sprintf("฿%.2f", totalRemainingBalance), props.Text{Size: 11, Align: consts.Right, Top: 5})
			m.Text(fmt.Sprintf("฿%.2f", totalPaidThisTime), props.Text{Size: 12, Style: consts.Bold, Align: consts.Right, Top: 12, Color: hexToColor("#E51C23")})
		})
	})

	// 9. Output
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate debt repayment receipt PDF: %w", err)
	}

	return buf.Bytes(), nil
}

// formatThaiDate แปลง time.Time เป็นวันที่ภาษาไทย เช่น 12 ต.ค. 2568
func formatThaiDate(t time.Time) string {
	var thaiMonths = [...]string{
		"", "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
		"ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
	}
	mIndex := int(t.Month())
	if mIndex >= 1 && mIndex <= 12 {
		return fmt.Sprintf("%d %s %d", t.Day(), thaiMonths[mIndex], t.Year()+543)
	}
	return t.Format("02/01/2006")
}
