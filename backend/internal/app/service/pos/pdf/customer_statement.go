package pdf

import (
	"fmt"
	"strings"
	"time"

	"backend/internal/app/entity"

	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

// CustomerStatementFilterOptions กำหนดตัวกรองสำหรับรายงานใบสรุปยอด
type CustomerStatementFilterOptions struct {
	PaymentType   string
	Status        string
	PaymentMethod string
}

// GenerateCustomerStatementPDF สร้างไฟล์ PDF รายงานใบสรุปประวัติการชำระเงินและยอดค้างชำระของลูกค้า
func GenerateCustomerStatementPDF(
	customer *entity.Customer,
	companyData *entity.CompanySetting,
	startDate, endDate string,
	filterOpts CustomerStatementFilterOptions,
	repayments []entity.PaymentRepayment,
	directPayments []entity.Payment,
	unpaidOrders []entity.SaleOrder,
) ([]byte, error) {
	if customer == nil {
		return nil, fmt.Errorf("customer cannot be nil")
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

	// 5. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	// วันที่พิมพ์เอกสาร
	now := time.Now()
	printDateStr := FormatThaiDate(now) + " " + now.Format("15:04 น.")

	// ช่วงเวลา
	periodStr := "ทั้งหมด"
	if startDate != "" && endDate != "" {
		st, _ := time.Parse("2006-01-02", startDate)
		et, _ := time.Parse("2006-01-02", endDate)
		periodStr = fmt.Sprintf("%s ถึง %s", FormatThaiDate(st), FormatThaiDate(et))
	} else if startDate != "" {
		st, _ := time.Parse("2006-01-02", startDate)
		periodStr = fmt.Sprintf("ตั้งแต่ %s", FormatThaiDate(st))
	} else if endDate != "" {
		et, _ := time.Parse("2006-01-02", endDate)
		periodStr = fmt.Sprintf("ถึง %s", FormatThaiDate(et))
	}

	// ข้อมูลลูกค้า
	custName := customer.CustomerName
	if customer.CustomerType.TypeLabel != "" {
		custName = fmt.Sprintf("%s (%s)", customer.CustomerName, customer.CustomerType.TypeLabel)
	}
	custPhone := "-"
	if customer.PhoneNumber != "" {
		custPhone = customer.PhoneNumber
	}
	custAddress := "-"
	if customer.ShippingAddress != "" {
		custAddress = customer.ShippingAddress
	} else if customer.RegisteredAddress != "" {
		custAddress = customer.RegisteredAddress
	}

	// -------------------------------------------------------------
	// 4. ส่วนหัวเอกสาร (Header - รูปแบบเดียวกับ sale_order.go)
	// -------------------------------------------------------------
	docTitle := "ใบสรุปยอดบัญชี\n(Customer Statement)"

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
			m.Col(4, func() {}) // ช่องว่างตรงกลาง
			m.Col(5, func() {
				titleLines := strings.Split(docTitle, "\n")
				fontSize := 20.0
				if len(titleLines) > 1 {
					fontSize = 17.0
				}
				topOffset := 0.0
				for _, line := range titleLines {
					m.Text(line, props.Text{
						Size:  fontSize,
						Style: consts.Bold,
						Align: consts.Center,
						Color: HexToColor("#E51C23"),
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
		m.Col(7, func() {
			m.Text(companyName, props.Text{Size: 12, Style: consts.Bold})
			m.Text(companyAddress, props.Text{Size: 11, Top: 5})
			m.Text(fmt.Sprintf("โทร. %s", companyPhone), props.Text{Size: 11, Top: 10})
			m.Text(fmt.Sprintf("อีเมล %s", companyEmail), props.Text{Size: 11, Top: 15})
			m.Text(fmt.Sprintf("เลขประจำตัวผู้เสียภาษี %s", companyTaxID), props.Text{Size: 11, Top: 20})
		})
		// ฝั่งขวา: หั่นย่อยเป็น 2 คอลัมน์ (Label สีแดง กับ Value)
		m.Col(2, func() {
			m.Text("รหัสลูกค้า", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Color: HexToColor("#E51C23")})
			m.Text("ช่วงเวลา", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: HexToColor("#E51C23")})
			m.Text("วันที่พิมพ์", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 10, Color: HexToColor("#E51C23")})
			m.Text("วงเงินเครดิต", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 15, Color: HexToColor("#E51C23")})
		})
		m.Col(3, func() {
			m.Text(fmt.Sprintf("CUST-%04d", customer.ID), props.Text{Size: 11, Align: consts.Left})
			m.Text(periodStr, props.Text{Size: 10.5, Align: consts.Left, Top: 5})
			m.Text(printDateStr, props.Text{Size: 10.5, Align: consts.Left, Top: 10})
			if customer.CreditLimit > 0 {
				m.Text(fmt.Sprintf("฿%.2f", customer.CreditLimit), props.Text{Size: 11, Align: consts.Left, Top: 15})
			} else {
				m.Text("-", props.Text{Size: 11, Align: consts.Left, Top: 15})
			}
		})
	})

	m.Row(5, func() {})

	// 6. ข้อมูลลูกค้า
	m.Row(18, func() {
		m.Col(12, func() {
			m.Text("ข้อมูลลูกค้า", props.Text{Size: 11, Style: consts.Bold, Color: HexToColor("#E51C23")})
			m.Text(fmt.Sprintf("ชื่อลูกค้า: %s", custName), props.Text{Size: 10.5, Top: 4.5})
			m.Text(fmt.Sprintf("ที่อยู่: %s  |  โทรศัพท์: %s", custAddress, custPhone), props.Text{Size: 10.5, Top: 9.5})
		})
	})

	m.Row(5, func() {})

	// -------------------------------------------------------------
	// ตารางที่ 1: ประวัติการรับชำระเงินในช่วงเวลา
	// -------------------------------------------------------------
	table1Title := "1. ประวัติการชำระเงินในช่วงเวลาที่เลือก"
	var filterBadges []string
	if strings.EqualFold(filterOpts.PaymentType, "repayment") {
		filterBadges = append(filterBadges, "ชำระหนี้เงินเชื่อ")
	} else if strings.EqualFold(filterOpts.PaymentType, "payment") {
		filterBadges = append(filterBadges, "ชำระสดหน้าร้าน")
	}
	if strings.EqualFold(filterOpts.Status, "completed") {
		filterBadges = append(filterBadges, "สำเร็จ")
	} else if strings.EqualFold(filterOpts.Status, "cancelled") {
		filterBadges = append(filterBadges, "ยกเลิกแล้ว")
	} else if strings.EqualFold(filterOpts.Status, "pending_cancel") {
		filterBadges = append(filterBadges, "รออนุมัติยกเลิก")
	}
	if filterOpts.PaymentMethod != "" {
		filterBadges = append(filterBadges, filterOpts.PaymentMethod)
	}
	if len(filterBadges) > 0 {
		table1Title = fmt.Sprintf("1. ประวัติการชำระเงินในช่วงเวลาที่เลือก (%s)", strings.Join(filterBadges, ", "))
	}

	m.Row(7, func() {
		m.Col(12, func() {
			m.Text(table1Title, props.Text{Size: 11, Style: consts.Bold, Color: HexToColor("#1C1B1B")})
		})
	})

	m.Line(1)
	m.Row(7, func() {
		m.Col(1, func() { m.Text("รอบที่", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("วันที่ชำระ", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("เลขที่ใบเสร็จ", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Left}) })
		m.Col(2, func() { m.Text("เลขที่บิล", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Left}) })
		m.Col(1, func() { m.Text("ช่องทาง", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("สถานะ", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("ยอดชำระ (฿)", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Right}) })
	})
	m.Line(1)

	var totalPaidInPeriod float64
	var validCount int
	var cancelledCount int
	roundIndex := 1

	isFilterCancelledOnly := strings.EqualFold(filterOpts.Status, "cancelled")

	// วนลูป Repayments (ตัดหนี้เงินเชื่อ)
	for _, r := range repayments {
		pDate := FormatThaiDate(r.CreatedAt)
		if r.PaidAt != nil {
			pDate = FormatThaiDate(*r.PaidAt)
		}

		isCancelled := strings.EqualFold(r.Status, "cancelled")
		isPendingCancel := strings.EqualFold(r.Status, "pending_cancel")

		receiptNo := r.ReceiptNumber
		if receiptNo == "" {
			receiptNo = fmt.Sprintf("RE-%d", r.ID)
		}

		if isCancelled {
			cancelledCount++
			if isFilterCancelledOnly {
				totalPaidInPeriod += r.AmountPaid
			}
		} else {
			validCount++
			totalPaidInPeriod += r.AmountPaid
		}

		m.Row(8.0, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", roundIndex), props.Text{Size: 9.5, Align: consts.Center}) })
			m.Col(2, func() { m.Text(pDate, props.Text{Size: 9.5, Align: consts.Center}) })
			m.Col(2, func() {
				m.Text(receiptNo, props.Text{Size: 9.5, Align: consts.Left})
				m.Text("(ชำระหนี้เงินเชื่อ)", props.Text{Size: 7.5, Align: consts.Left, Top: 4.0, Color: HexToColor("#6B7280")})
			})
			m.Col(2, func() { m.Text(r.Order.OrderNumber, props.Text{Size: 9.5, Align: consts.Left}) })
			m.Col(1, func() { m.Text(r.PaymentMethod.MethodName, props.Text{Size: 9, Align: consts.Center}) })
			m.Col(2, func() {
				if isCancelled {
					m.Text("ยกเลิกแล้ว", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Color: HexToColor("#E51C23")})
					m.Text("(CANCELLED)", props.Text{Size: 7, Style: consts.Bold, Align: consts.Center, Top: 4.0, Color: HexToColor("#E51C23")})
				} else if isPendingCancel {
					m.Text("รออนุมัติยกเลิก", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Color: HexToColor("#D97706")})
				} else {
					m.Text("สำเร็จ", props.Text{Size: 9, Align: consts.Center, Color: HexToColor("#059669")})
				}
			})
			m.Col(2, func() {
				if isCancelled && !isFilterCancelledOnly {
					m.Text(fmt.Sprintf("%.2f", r.AmountPaid), props.Text{Size: 9.5, Align: consts.Right, Color: HexToColor("#9CA3AF")})
					m.Text("(ไม่รวมยอด)", props.Text{Size: 7.5, Align: consts.Right, Top: 4.0, Color: HexToColor("#E51C23")})
				} else {
					m.Text(fmt.Sprintf("%.2f", r.AmountPaid), props.Text{Size: 9.5, Align: consts.Right})
				}
			})
		})
		roundIndex++
	}

	// วนลูป Direct Payments (ชำระสดหน้าร้าน)
	for _, p := range directPayments {
		pDate := FormatThaiDate(p.CreatedAt)
		if p.PaidAt != nil {
			pDate = FormatThaiDate(*p.PaidAt)
		}

		isCancelled := strings.EqualFold(string(p.Order.Status), "cancelled")
		isPendingCancel := strings.EqualFold(string(p.Order.Status), "pending_cancel")

		if isCancelled {
			cancelledCount++
			if isFilterCancelledOnly {
				totalPaidInPeriod += p.Amount
			}
		} else {
			validCount++
			totalPaidInPeriod += p.Amount
		}

		m.Row(8.0, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", roundIndex), props.Text{Size: 9.5, Align: consts.Center}) })
			m.Col(2, func() { m.Text(pDate, props.Text{Size: 9.5, Align: consts.Center}) })
			m.Col(2, func() {
				m.Text(p.Order.OrderNumber, props.Text{Size: 9.5, Align: consts.Left})
				m.Text("(ชำระสดหน้าร้าน)", props.Text{Size: 7.5, Align: consts.Left, Top: 4.0, Color: HexToColor("#6B7280")})
			})
			m.Col(2, func() { m.Text(p.Order.OrderNumber, props.Text{Size: 9.5, Align: consts.Left}) })
			m.Col(1, func() { m.Text(p.PaymentMethod.MethodName, props.Text{Size: 9, Align: consts.Center}) })
			m.Col(2, func() {
				if isCancelled {
					m.Text("ยกเลิกแล้ว", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Color: HexToColor("#E51C23")})
					m.Text("(CANCELLED)", props.Text{Size: 7, Style: consts.Bold, Align: consts.Center, Top: 4.0, Color: HexToColor("#E51C23")})
				} else if isPendingCancel {
					m.Text("รออนุมัติยกเลิก", props.Text{Size: 9, Style: consts.Bold, Align: consts.Center, Color: HexToColor("#D97706")})
				} else {
					m.Text("สำเร็จ", props.Text{Size: 9, Align: consts.Center, Color: HexToColor("#059669")})
				}
			})
			m.Col(2, func() {
				if isCancelled && !isFilterCancelledOnly {
					m.Text(fmt.Sprintf("%.2f", p.Amount), props.Text{Size: 9.5, Align: consts.Right, Color: HexToColor("#9CA3AF")})
					m.Text("(ไม่รวมยอด)", props.Text{Size: 7.5, Align: consts.Right, Top: 4.0, Color: HexToColor("#E51C23")})
				} else {
					m.Text(fmt.Sprintf("%.2f", p.Amount), props.Text{Size: 9.5, Align: consts.Right})
				}
			})
		})
		roundIndex++
	}

	if roundIndex == 1 {
		m.Row(7, func() {
			m.Col(12, func() {
				m.Text("- ไม่พบรายการชำระเงินตามเงื่อนไขตัวกรองที่เลือก -", props.Text{Size: 9.5, Align: consts.Center, Color: HexToColor("#6B7280")})
			})
		})
	}

	summaryLabel := fmt.Sprintf("รวมยอดรับชำระสุทธิ (%d รายการ)", validCount)
	if isFilterCancelledOnly {
		summaryLabel = fmt.Sprintf("รวมยอดที่ยกเลิกทั้งหมด (%d รายการ)", cancelledCount)
	} else if cancelledCount > 0 {
		summaryLabel = fmt.Sprintf("รวมยอดรับชำระสุทธิ (%d รายการสำเร็จ, ยกเลิก %d รายการ - ไม่รวมยอด)", validCount, cancelledCount)
	}

	m.Line(1)
	m.Row(7, func() {
		m.Col(10, func() {
			m.Text(summaryLabel, props.Text{Size: 10, Style: consts.Bold, Align: consts.Right})
		})
		m.Col(2, func() {
			m.Text(fmt.Sprintf("฿%.2f", totalPaidInPeriod), props.Text{Size: 10, Style: consts.Bold, Align: consts.Right, Color: HexToColor("#E51C23")})
		})
	})

	m.Row(4, func() {})

	showUnpaidSection := !strings.EqualFold(filterOpts.PaymentType, "payment") && !strings.EqualFold(filterOpts.Status, "cancelled")

	if showUnpaidSection {
		// -------------------------------------------------------------
		// ตารางที่ 2: รายการบิลที่ยังมียอดค้างชำระในปัจจุบัน
		// -------------------------------------------------------------
		m.Row(7, func() {
			m.Col(12, func() {
				m.Text("2. รายการบิลที่ยังมียอดคงเหลือค้างชำระในปัจจุบัน", props.Text{Size: 11, Style: consts.Bold, Color: HexToColor("#1C1B1B")})
			})
		})

		m.Line(1)
		if len(unpaidOrders) == 0 {
			m.Row(7, func() {
				m.Col(12, func() {
					m.Text("- ไม่มีบิลค้างชำระ (ยอดหนี้คงเหลือ ฿0.00) -", props.Text{Size: 9.5, Align: consts.Center, Color: HexToColor("#059669")})
				})
			})
			m.Line(1)
		} else {
			m.Row(7, func() {
				m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Center}) })
				m.Col(3, func() { m.Text("เลขที่บิล", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Left}) })
				m.Col(2, func() { m.Text("วันที่ออกบิล", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Center}) })
				m.Col(2, func() { m.Text("ยอดตามบิล (฿)", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Right}) })
				m.Col(2, func() { m.Text("ชำระแล้ว (฿)", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Right}) })
				m.Col(2, func() { m.Text("ยอดคงเหลือ (฿)", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Right, Color: HexToColor("#E51C23")}) })
			})
			m.Line(1)

			var totalUnpaidDebt float64
			for i, o := range unpaidOrders {
				totalUnpaidDebt += o.BalanceDue
				m.Row(6.5, func() {
					m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 9.5, Align: consts.Center}) })
					m.Col(3, func() { m.Text(o.OrderNumber, props.Text{Size: 9.5, Align: consts.Left}) })
					m.Col(2, func() { m.Text(FormatThaiDate(o.CreatedAt), props.Text{Size: 9.5, Align: consts.Center}) })
					m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", o.TotalAmount), props.Text{Size: 9.5, Align: consts.Right}) })
					m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", o.PaidAmount), props.Text{Size: 9.5, Align: consts.Right}) })
					m.Col(2, func() { m.Text(fmt.Sprintf("%.2f", o.BalanceDue), props.Text{Size: 9.5, Align: consts.Right, Color: HexToColor("#E51C23")}) })
				})
			}

			m.Line(1)
			m.Row(7, func() {
				m.Col(10, func() {
					m.Text(fmt.Sprintf("รวมยอดหนี้ค้างชำระคงเหลือทั้งหมด (%d บิล)", len(unpaidOrders)), props.Text{Size: 10, Style: consts.Bold, Align: consts.Right})
				})
				m.Col(2, func() {
					m.Text(fmt.Sprintf("฿%.2f", totalUnpaidDebt), props.Text{Size: 10, Style: consts.Bold, Align: consts.Right, Color: HexToColor("#E51C23")})
				})
			})
		}

		m.Row(5, func() {})
	}

	// -------------------------------------------------------------
	// ส่วนสรุปภาพรวมทางการเงิน
	// -------------------------------------------------------------
	thaiTextPaid := ThaiBahtText(totalPaidInPeriod)
	currentDebt := customer.CurrentDebtAmount

	summaryRowHeight := 24.0
	if !showUnpaidSection {
		summaryRowHeight = 18.0
	}

	periodPaidLabel := "ยอดรับชำระสุทธิในช่วงเวลา:"
	periodPaidTextLabel := "ยอดชำระสุทธิตัวอักษร:"
	if isFilterCancelledOnly {
		periodPaidLabel = "ยอดยกเลิกในช่วงเวลา:"
		periodPaidTextLabel = "ยอดยกเลิกตัวอักษร:"
	}

	m.Row(summaryRowHeight, func() {
		m.Col(6, func() {
			m.Text("สรุปภาพรวม:", props.Text{Size: 11, Style: consts.Bold})
			m.Text(fmt.Sprintf("%s %s", periodPaidTextLabel, thaiTextPaid), props.Text{Size: 10, Top: 4})
			if showUnpaidSection && customer.CreditLimit > 0 {
				m.Text(fmt.Sprintf("วงเงินเครดิตที่ได้รับ: ฿%.2f", customer.CreditLimit), props.Text{Size: 10, Top: 8})
			}
		})
		m.Col(3, func() {
			m.Text(periodPaidLabel, props.Text{Size: 10.5, Align: consts.Left})
			if showUnpaidSection {
				m.Text("ยอดหนี้คงเหลือปัจจุบัน:", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: HexToColor("#E51C23")})
			}
		})
		m.Col(3, func() {
			m.Text(fmt.Sprintf("฿%.2f", totalPaidInPeriod), props.Text{Size: 10.5, Align: consts.Right})
			if showUnpaidSection {
				m.Text(fmt.Sprintf("฿%.2f", currentDebt), props.Text{Size: 12, Style: consts.Bold, Align: consts.Right, Top: 5, Color: HexToColor("#E51C23")})
			}
		})
	})

	m.Row(10, func() {})

	// ลายมือชื่อ
	m.Row(18, func() {
		m.Col(6, func() {
			m.Text("ลงชื่อ ................................................................", props.Text{Size: 10, Align: consts.Center})
			m.Text("( พนักงานผู้จัดทำเอกสาร )", props.Text{Size: 9.5, Align: consts.Center, Top: 5})
		})
		m.Col(6, func() {
			m.Text("ลงชื่อ ................................................................", props.Text{Size: 10, Align: consts.Center})
			m.Text("( ลูกค้า / ผู้ตรวจสอบรับทราบยอด )", props.Text{Size: 9.5, Align: consts.Center, Top: 5})
		})
	})

	// Output
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate customer statement PDF: %w", err)
	}

	return buf.Bytes(), nil
}
