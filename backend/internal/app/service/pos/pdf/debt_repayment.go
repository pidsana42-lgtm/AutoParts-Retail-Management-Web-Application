package pdf

import (
	"fmt"

	"backend/internal/app/entity"

	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

// GenerateDebtRepaymentReceiptPDF สร้างไฟล์ PDF ใบเสร็จรับเงิน (ชำระหนี้)
func GenerateDebtRepaymentReceiptPDF(
	repayments []entity.PaymentRepayment,
	companyData *entity.CompanySetting,
	getPreviousRepaymentsSum func(orderID, repaymentID uint) (float64, error),
) ([]byte, error) {
	if len(repayments) == 0 {
		return nil, fmt.Errorf("no repayments provided for debt repayment receipt")
	}

	firstRepayment := repayments[0]

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
					Color: HexToColor("#E51C23"),
					Top:   0,
				})
				m.Text("(ชำระหนี้)", props.Text{
					Size:  16.0,
					Style: consts.Bold,
					Align: consts.Center,
					Color: HexToColor("#E51C23"),
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
			m.Text("เลขที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Color: HexToColor("#E51C23")})
			m.Text("วันที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: HexToColor("#E51C23")})
			m.Text("พนักงาน", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 10, Color: HexToColor("#E51C23")})
			m.Text("ชำระโดย", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 15, Color: HexToColor("#E51C23")})
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
			m.Text("ลูกค้า", props.Text{Size: 11, Style: consts.Bold, Color: HexToColor("#E51C23")})
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
		m.Col(2, func() { m.Text("เลขที่บิลขาย", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
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
		orderDate := FormatThaiDate(r.Order.CreatedAt)
		originalDebt := r.Order.TotalAmount
		paidBefore := float64(0)
		if getPreviousRepaymentsSum != nil {
			sum, _ := getPreviousRepaymentsSum(r.OrderID, r.ID)
			paidBefore = sum
		}
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
			m.Text("หมายเหตุ", props.Text{Size: 11, Style: consts.Bold, Color: HexToColor("#E51C23")})
			m.Text("1. ใบเสร็จรับเงินนี้จะสมบูรณ์เมื่อทางร้านได้รับชำระเงินเรียบร้อยแล้ว", props.Text{Size: 10, Top: 5})
			m.Text(fmt.Sprintf("จำนวนเงินที่ชำระ (ตัวอักษร): %s", thaiText), props.Text{Size: 10, Style: consts.Bold, Top: 11})
		})

		// สรุปยอดเงิน (ขวา)
		m.Col(3, func() {
			m.Text("ยอดค้างก่อนจ่าย", props.Text{Size: 11, Align: consts.Left})
			m.Text("ยอดคงเหลือหลังชำระ", props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text("ยอดชำระครั้งนี้ทั้งสิ้น", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 12, Color: HexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(fmt.Sprintf("฿%.2f", totalBalanceBefore), props.Text{Size: 11, Align: consts.Right})
			m.Text(fmt.Sprintf("฿%.2f", totalRemainingBalance), props.Text{Size: 11, Align: consts.Right, Top: 5})
			m.Text(fmt.Sprintf("฿%.2f", totalPaidThisTime), props.Text{Size: 12, Style: consts.Bold, Align: consts.Right, Top: 12, Color: HexToColor("#E51C23")})
		})
	})

	// 9. Output
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate debt repayment receipt PDF: %w", err)
	}

	return buf.Bytes(), nil
}
