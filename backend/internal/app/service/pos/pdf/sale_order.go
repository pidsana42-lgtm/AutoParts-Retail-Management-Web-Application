package pdf

import (
	"fmt"
	"math"
	"strings"

	"backend/internal/app/entity"
	"backend/internal/pkg/crypto"

	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

// GenerateSaleOrderPDF สร้างไฟล์ PDF บิลขาย / ใบเสร็จรับเงินสด / ใบส่งของชั่วคราว
func GenerateSaleOrderPDF(order *entity.SaleOrder, companyData *entity.CompanySetting, customTitle string) ([]byte, error) {
	if order == nil {
		return nil, fmt.Errorf("sale order cannot be nil")
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

	bankName := ""
	bankAccountNo := ""
	bankAccountName := ""
	if companyData != nil {
		bankName = companyData.BankName
		bankAccountNo = companyData.BankAccountNumber
		bankAccountName = companyData.BankAccountName
	}
	if crypto.IsEncrypted(bankAccountNo) {
		if dec, err := crypto.DecryptAES256(bankAccountNo); err == nil {
			bankAccountNo = dec
		}
	}

	// 2. กำหนดหัวข้อเอกสาร (Document Title)
	statusLower := strings.ToLower(strings.TrimSpace(string(order.Status)))
	isCancelled := statusLower == "cancelled" || statusLower == "ยกเลิก"
	isReturned := statusLower == "returned" || statusLower == "refunded" || statusLower == "คืนสินค้าแล้ว"
	isPartialReturned := statusLower == "partial_returned" || statusLower == "คืนบางส่วน"
	isClaimed := statusLower == "claimed" || statusLower == "เคลมสินค้าแล้ว"
	isClaimInProgress := statusLower == "claim_in_progress" || statusLower == "pending_claim" || statusLower == "อยู่ระหว่างเคลม"
	isPendingReturn := statusLower == "pending_return" || statusLower == "รออนุมัติคืน"

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

	if isCancelled {
		docTitle = docTitle + "\n(ยกเลิกแล้ว / CANCELLED)"
	} else if isReturned {
		docTitle = docTitle + "\n(คืนสินค้าแล้ว / RETURNED)"
	} else if isPartialReturned {
		docTitle = docTitle + "\n(คืนสินค้าบางส่วน / PARTIAL RETURNED)"
	} else if isClaimed {
		docTitle = docTitle + "\n(เคลมสินค้าแล้ว / CLAIMED)"
	} else if isClaimInProgress {
		docTitle = docTitle + "\n(อยู่ระหว่างเคลม / IN PROGRESS)"
	} else if isPendingReturn {
		docTitle = docTitle + "\n(รออนุมัติคืน / PENDING RETURN)"
	}

	// 3. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, ResolveFontPath("assets/fonts/THSarabunNew.ttf"))
	m.AddUTF8Font("THSarabun", consts.Bold, ResolveFontPath("assets/fonts/THSarabunNew Bold.ttf"))
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
			paymentMethodStr = "เงินโอน / QR"
		case 3:
			paymentMethodStr = "เงินเชื่อ"
		}
	}

	isCredit := (order.PaymentMethodID != nil && *order.PaymentMethodID == 3) || strings.Contains(paymentMethodStr, "เชื่อ")
	dueDate := order.DueDate
	if dueDate == nil && isCredit {
		fallback := order.CreatedAt.AddDate(0, 0, 30)
		dueDate = &fallback
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
		typeTag := order.Customer.CustomerType.TypeLabel
		if typeTag == "" {
			typeTag = order.Customer.CustomerType.TypeName
		}
		if typeTag != "" {
			custName = fmt.Sprintf("%s (%s)", order.Customer.CustomerName, typeTag)
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

	logoPath, logoBase64, logoExtension, _ := LoadLogo(nil, logoURL)

	// 4. ส่วนหัวเอกสาร (Header)
	m.RegisterHeader(func() {
		m.Row(25, func() {
			m.Col(3, func() {
				if logoPath != "" {
					_ = m.FileImage(logoPath, props.Rect{
						Percent: 400,
						Center:  false, // ให้โลโก้ชิดซ้าย
					})
				} else if logoBase64 != "" {
					_ = m.Base64Image(logoBase64, logoExtension, props.Rect{
						Percent: 400,
						Center:  false,
					})
				}
			})
			m.Col(4, func() {}) // ช่องว่างตรงกลาง
			m.Col(5, func() {
				titleLines := strings.Split(docTitle, "\n")
				fontSize := 22.0
				if len(titleLines) > 1 {
					fontSize = 16.0
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
					topOffset += 6.0
				}
			})
		})
	})

	// ส่วนท้ายเอกสาร (Footer) - วาง Barcode ตรงกลางด้านล่างติดขอบ
	m.RegisterFooter(func() {
		if order.OrderNumber != "" {
			m.Row(10, func() {
				m.Col(12, func() {
					_ = m.Barcode(order.OrderNumber, props.Barcode{
						Center:  true,
						Percent: 95,
						Proportion: props.Proportion{
							Width:  20,
							Height: 3.5,
						},
					})
				})
			})
			// Barcode Text
			m.Row(4, func() {
				m.Col(12, func() {
					m.Text(order.OrderNumber, props.Text{
						Size:  8.0,
						Align: consts.Center,
						Top:   0.5,
						Color: HexToColor("#4B5563"),
					})
				})
			})
		}
	})

	m.Row(5, func() {}) // เว้นบรรทัด

	// แถบแจ้งเตือนเอกสารถูกยกเลิก (Void / Cancelled Banner)
	if isCancelled {
		cancelDateStr := "-"
		if order.CancelProcessedAt != nil {
			cancelDateStr = FormatThaiDate(*order.CancelProcessedAt) + " " + order.CancelProcessedAt.Format("15:04 น.")
		} else if order.CancelRequestedAt != nil {
			cancelDateStr = FormatThaiDate(*order.CancelRequestedAt) + " " + order.CancelRequestedAt.Format("15:04 น.")
		} else {
			cancelDateStr = FormatThaiDate(order.UpdatedAt) + " " + order.UpdatedAt.Format("15:04 น.")
		}

		approverStr := "เจ้าของร้าน"
		if order.CancelRequestedBy != nil && order.CancelRequestedBy.FirstName != "" {
			approverStr = fmt.Sprintf("%s %s", order.CancelRequestedBy.FirstName, order.CancelRequestedBy.LastName)
		}

		reasonStr := "-"
		if order.CancelReason != nil && *order.CancelReason != "" {
			reasonStr = *order.CancelReason
		} else if order.CancelRemark != nil && *order.CancelRemark != "" {
			reasonStr = *order.CancelRemark
		}

		m.Row(16, func() {
			m.Col(12, func() {
				m.Text("*** เอกสารนี้ถูกยกเลิกแล้ว (CANCELLED / VOID) ***", props.Text{
					Size:  12.5,
					Style: consts.Bold,
					Align: consts.Center,
					Color: HexToColor("#E51C23"),
					Top:   1.0,
				})
				detailText := fmt.Sprintf("วันที่ยกเลิก: %s    |    ผู้อนุมัติ: %s    |    เหตุผลการยกเลิก: %s", cancelDateStr, approverStr, reasonStr)
				m.Text(detailText, props.Text{
					Size:  9.5,
					Style: consts.Normal,
					Align: consts.Center,
					Color: HexToColor("#1C1B1B"),
					Top:   6.5,
				})
			})
		})
		m.Line(1)
		m.Row(3, func() {})
	}

	// 5. ข้อมูลบริษัท (ซ้าย) และ ข้อมูลเอกสาร (ขวา)
	companyRowHeight := 25.0
	if isCredit && dueDate != nil {
		companyRowHeight += 5.0
	}
	if isCancelled {
		companyRowHeight += 5.0
	}
	m.Row(companyRowHeight, func() {
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
			m.Text("เลขที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Color: HexToColor("#E51C23")})
			m.Text("วันที่", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 5, Color: HexToColor("#E51C23")})
			m.Text("พนักงาน", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 10, Color: HexToColor("#E51C23")})
			m.Text("ชำระโดย", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 15, Color: HexToColor("#E51C23")})
			currentTop := 20.0
			if isCredit && dueDate != nil {
				m.Text("กำหนดชำระ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#E51C23")})
				currentTop += 5.0
			}
			if isCancelled || isReturned || isPartialReturned || isClaimed || isClaimInProgress || isPendingReturn {
				statusColor := "#E51C23"
				if isReturned || isPendingReturn {
					statusColor = "#D97706"
				} else if isPartialReturned {
					statusColor = "#EA580C"
				} else if isClaimed {
					statusColor = "#7C3AED"
				} else if isClaimInProgress {
					statusColor = "#4F46E5"
				}
				m.Text("สถานะ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor(statusColor)})
			}
		})
		m.Col(3, func() {
			m.Text(order.OrderNumber, props.Text{Size: 11, Align: consts.Left})
			m.Text(orderDate, props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text(salesStaff, props.Text{Size: 11, Align: consts.Left, Top: 10})
			m.Text(paymentMethodStr, props.Text{Size: 11, Align: consts.Left, Top: 15})
			currentTop := 20.0
			if isCredit && dueDate != nil {
				m.Text(FormatThaiDate(*dueDate), props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#E51C23")})
				currentTop += 5.0
			}
			if isCancelled {
				m.Text("ยกเลิกแล้ว (CANCELLED)", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#E51C23")})
			} else if isReturned {
				m.Text("คืนสินค้าแล้ว (RETURNED)", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#D97706")})
			} else if isPartialReturned {
				m.Text("คืนสินค้าบางส่วน (PARTIAL RETURNED)", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#EA580C")})
			} else if isClaimed {
				m.Text("เคลมสินค้าแล้ว (CLAIMED)", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#7C3AED")})
			} else if isClaimInProgress {
				m.Text("อยู่ระหว่างเคลม (IN PROGRESS)", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#4F46E5")})
			} else if isPendingReturn {
				m.Text("รออนุมัติคืน (PENDING RETURN)", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: currentTop, Color: HexToColor("#D97706")})
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

	// 7. สร้างตารางแบบ Manual (เส้นขอบบน ล่าง และรายการสินค้า)
	m.Line(1)

	// หัวตาราง
	m.Row(8, func() {
		m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Center, Top: 0.5}) })
		m.Col(2, func() { m.Text("รหัสสินค้า", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Left, Top: 0.5}) })
		m.Col(4, func() { m.Text("ชื่อสินค้า / รายการ", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Left, Top: 0.5}) })
		m.Col(1, func() { m.Text("จำนวน", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 0.5}) })
		m.Col(1, func() { m.Text("หน่วย", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Center, Top: 0.5}) })
		m.Col(1, func() { m.Text("ราคา/หน่วย", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 0.5}) })
		m.Col(1, func() { m.Text("ส่วนลด", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 0.5}) })
		m.Col(1, func() { m.Text("จำนวนเงิน", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 0.5}) })
	})

	m.Line(1)

	// คำนวณความกว้างคอลัมน์ชื่อสินค้า (Col 4 จาก 12 ส่วน)
	pageWidth, _ := m.GetPageSize()
	leftMargin, _, rightMargin, _ := m.GetPageMargins()
	col4Width := (pageWidth - leftMargin - rightMargin) * (4.0 / 12.0)

	// วนลูปข้อมูลสินค้า (Content)
	for i, item := range order.Items {
		itemCode := item.PartNumber
		if item.Product.Product_Code != "" {
			itemCode = item.Product.Product_Code
		} else if itemCode == "" {
			itemCode = "-"
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

		specsLine := GetItemSubDetails(item)
		if item.PartNumber != "" && item.PartNumber != itemCode {
			if specsLine != "" {
				specsLine = fmt.Sprintf("PN: %s  |  %s", item.PartNumber, specsLine)
			} else {
				specsLine = fmt.Sprintf("PN: %s", item.PartNumber)
			}
		}

		nameLines := wrapTextToLines(m, item.ProductName, "THSarabun", "B", 10.0, col4Width)
		var specLines []string
		if specsLine != "" {
			specLines = wrapTextToLines(m, specsLine, "THSarabun", "", 8.5, col4Width)
		}

		lineHeightName := 4.0
		lineHeightSpec := 3.5
		totalNameHeight := float64(len(nameLines)) * lineHeightName
		totalSpecHeight := float64(len(specLines)) * lineHeightSpec

		var rowHeight float64
		if len(specLines) == 0 {
			rowHeight = math.Max(7.5, 0.5+totalNameHeight+2.5)
		} else {
			rowHeight = math.Max(11.0, 0.5+totalNameHeight+totalSpecHeight+2.5)
		}

		discountStr := "-"
		if itemDiscount > 0 {
			discountStr = fmt.Sprintf("%.2f", itemDiscount)
		}

		m.Row(rowHeight, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 10, Align: consts.Center, Top: 0.5}) })
			m.Col(2, func() { m.Text(itemCode, props.Text{Size: 10, Align: consts.Left, Top: 0.5}) })
			m.Col(4, func() {
				currentTop := 0.5
				for _, line := range nameLines {
					m.Text(line, props.Text{Size: 10, Style: consts.Bold, Align: consts.Left, Top: currentTop})
					currentTop += lineHeightName
				}
				if len(specLines) > 0 {
					for _, sLine := range specLines {
						m.Text(sLine, props.Text{Size: 8.5, Top: currentTop, Color: HexToColor("#4B5563"), Align: consts.Left})
						currentTop += lineHeightSpec
					}
				}
			})
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", item.Qty), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
			m.Col(1, func() { m.Text(itemUnit, props.Text{Size: 10, Align: consts.Center, Top: 0.5}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", item.UnitPrice), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
			m.Col(1, func() { m.Text(discountStr, props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
			m.Col(1, func() { m.Text(fmt.Sprintf("%.2f", itemTotal), props.Text{Size: 10, Align: consts.Right, Top: 0.5}) })
		})
	}

	m.Line(1)

	m.Row(4, func() {}) // เว้นบรรทัดหลังตาราง

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

	isCash := (order.PaymentMethodID != nil && *order.PaymentMethodID == 1) || strings.Contains(paymentMethodStr, "สด")
	receivedAmt := order.ReceivedAmount
	if isCash && receivedAmt <= 0 {
		receivedAmt = order.TotalAmount
	}
	changeAmt := order.ChangeAmount
	if isCash && changeAmt <= 0 && receivedAmt > order.TotalAmount {
		changeAmt = receivedAmt - order.TotalAmount
	}

	summaryHeight := 28.0
	if isCash {
		summaryHeight = 36.0
	} else if isCredit && dueDate != nil {
		summaryHeight = 34.0
	}
	if bankAccountNo != "" && bankName != "" {
		summaryHeight += 5.0
	}

	m.Row(summaryHeight, func() {
		// หมายเหตุ + คำอ่าน (ซ้าย)
		m.Col(6, func() {
			m.Text("หมายเหตุ", props.Text{Size: 11, Style: consts.Bold, Color: HexToColor("#E51C23")})
			m.Text("1. สินค้าตามใบเสร็จรับเงิน/ใบส่งของนี้ หากมีการขาดตกบกพร่องประการใด โปรดแจ้งให้ทางร้านฯ ทราบ", props.Text{
				Size: 9.5,
				Top:  4.5,
			})
			m.Text("ภายใน 7 วัน มิฉะนั้นทางร้านฯ จะไม่รับผิดชอบความเสียหายใดๆ ทั้งสิ้น", props.Text{
				Size: 9.5,
				Top:  8.5,
			})
			m.Text("2. ใบเสร็จรับเงินนี้จะสมบูรณ์เมื่อทางร้านฯ ได้รับชำระเงินเรียบร้อยแล้ว", props.Text{
				Size: 9.5,
				Top:  12.5,
			})
			thaiTextTop := 18.0
			if isCredit && dueDate != nil {
				m.Text(fmt.Sprintf("3. รายการนี้เป็นการขายเชื่อ กำหนดชำระเงินภายในวันที่ %s", FormatThaiDate(*dueDate)), props.Text{
					Size:  9.5,
					Style: consts.Bold,
					Top:   16.5,
					Color: HexToColor("#E51C23"),
				})
				thaiTextTop = 21.5
			}
			if bankAccountNo != "" && bankName != "" {
				bankLabel := fmt.Sprintf("บัญชีโอนเงิน: %s เลขที่ %s", bankName, bankAccountNo)
				if bankAccountName != "" {
					bankLabel += fmt.Sprintf(" (%s)", bankAccountName)
				}
				m.Text(bankLabel, props.Text{
					Size:  9.5,
					Style: consts.Bold,
					Top:   thaiTextTop,
					Color: HexToColor("#1F2937"),
				})
				// ปรับระยะห่างตามความยาวข้อความ หากข้อความยาวและถูกตัดบรรทัด ป้องกันข้อความทับกัน
				if len([]rune(bankLabel)) > 55 {
					thaiTextTop += 9.0
				} else {
					thaiTextTop += 5.0
				}
			}
			m.Text(fmt.Sprintf("จำนวนเงินทั้งสิ้น (ตัวอักษร): %s", thaiText), props.Text{
				Size:  9.5,
				Style: consts.Bold,
				Top:   thaiTextTop,
			})
		})

		// สรุปยอดเงิน (ขวา)
		m.Col(3, func() {
			m.Text("ราคารวมสินค้า", props.Text{Size: 10.5, Align: consts.Left})
			m.Text("ส่วนลดตามรายการ", props.Text{Size: 10.5, Align: consts.Left, Top: 4.5})
			m.Text("ส่วนลดท้ายบิล", props.Text{Size: 10.5, Align: consts.Left, Top: 9.0})
			m.Text("ส่วนลดรวมทั้งสิ้น", props.Text{Size: 10.5, Align: consts.Left, Top: 13.5})
			m.Text("ยอดเงินสุทธิทั้งสิ้น", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left, Top: 19.0, Color: HexToColor("#E51C23")})
			if isCash {
				m.Text("รับเงินมา", props.Text{Size: 10.5, Align: consts.Left, Top: 25.0})
				m.Text("เงินทอน", props.Text{Size: 10.5, Align: consts.Left, Top: 29.5})
			}
		})
		m.Col(3, func() {
			m.Text(fmt.Sprintf("฿%.2f", grossTotal), props.Text{Size: 10.5, Align: consts.Right})
			if lineDiscounts > 0 {
				m.Text(fmt.Sprintf("-฿%.2f", lineDiscounts), props.Text{Size: 10.5, Align: consts.Right, Top: 4.5})
			} else {
				m.Text("-", props.Text{Size: 10.5, Align: consts.Right, Top: 4.5})
			}
			if billDiscount > 0 {
				m.Text(fmt.Sprintf("-฿%.2f", billDiscount), props.Text{Size: 10.5, Align: consts.Right, Top: 9.0})
			} else {
				m.Text("-", props.Text{Size: 10.5, Align: consts.Right, Top: 9.0})
			}
			if totalDiscount > 0 {
				m.Text(fmt.Sprintf("-฿%.2f", totalDiscount), props.Text{Size: 10.5, Align: consts.Right, Top: 13.5})
			} else {
				m.Text("-", props.Text{Size: 10.5, Align: consts.Right, Top: 13.5})
			}
			m.Text(fmt.Sprintf("฿%.2f", order.TotalAmount), props.Text{Size: 12, Style: consts.Bold, Align: consts.Right, Top: 19.0, Color: HexToColor("#E51C23")})
			if isCash {
				m.Text(fmt.Sprintf("฿%.2f", receivedAmt), props.Text{Size: 10.5, Align: consts.Right, Top: 25.0})
				m.Text(fmt.Sprintf("฿%.2f", changeAmt), props.Text{Size: 10.5, Align: consts.Right, Top: 29.5})
			}
		})
	})

	m.Row(6, func() {}) // เว้นบรรทัดก่อนลายมือชื่อ

	// 9. ลายมือชื่อพนักงานและลูกค้า (Footer Signatures)
	custSignName := custName
	if order.Customer.CustomerName != "" {
		custSignName = order.Customer.CustomerName
	} else if order.CustomerNameTemp != nil && *order.CustomerNameTemp != "" {
		custSignName = *order.CustomerNameTemp
	}

	m.Row(22, func() {
		m.Col(6, func() {
			m.Text("ลงชื่อ ................................................................", props.Text{Size: 10, Align: consts.Center})
			m.Text(fmt.Sprintf("( %s )", salesStaff), props.Text{Size: 9.5, Align: consts.Center, Top: 5})
			m.Text("ผู้รับเงิน / พนักงานขาย", props.Text{Size: 9, Align: consts.Center, Top: 10, Color: HexToColor("#4B5563")})
			m.Text("วันที่ ......./......./............", props.Text{Size: 9, Align: consts.Center, Top: 14.5, Color: HexToColor("#6B7280")})
		})
		m.Col(6, func() {
			m.Text("ลงชื่อ ................................................................", props.Text{Size: 10, Align: consts.Center})
			m.Text(fmt.Sprintf("( %s )", custSignName), props.Text{Size: 9.5, Align: consts.Center, Top: 5})
			m.Text("ผู้รับสินค้า / ลูกค้า", props.Text{Size: 9, Align: consts.Center, Top: 10, Color: HexToColor("#4B5563")})
			m.Text("วันที่ ......./......./............", props.Text{Size: 9, Align: consts.Center, Top: 14.5, Color: HexToColor("#6B7280")})
		})
	})

	// 10. นำออกเป็น Byte Array
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate PDF: %w", err)
	}

	return buf.Bytes(), nil
}

// wrapTextToLines ตัดข้อความออกเป็นบรรทัดตามความกว้างคอลัมน์จริง รองรับทั้งภาษาไทยและอังกฤษ ป้องกันข้อความทับซ้อนหรือล้นตาราง
func wrapTextToLines(m pdf.Maroto, text string, fontName string, fontStyle string, fontSize float64, colWidth float64) []string {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}

	var getWidth func(s string) float64
	if doc, ok := m.(*pdf.PdfMaroto); ok && doc.Pdf != nil {
		doc.Pdf.SetFont(fontName, fontStyle, fontSize)
		getWidth = func(s string) float64 { return doc.Pdf.GetStringWidth(s) }
	} else {
		// Fallback approximation: ~1.7mm ต่อตัวอักษรสำหรับ THSarabun ขนาด 10pt
		scale := fontSize / 10.0
		getWidth = func(s string) float64 { return float64(len([]rune(s))) * 1.7 * scale }
	}

	var wrappedLines []string
	for _, para := range strings.Split(text, "\n") {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}
		rawWords := strings.Split(para, " ")
		var safeWords []string
		for _, w := range rawWords {
			if w == "" {
				continue
			}
			// หากคำเดียวยาวเกินความกว้างคอลัมน์ (เช่น ภาษาไทยที่ไม่มีวรรค หรือข้อความยาวติดกัน) ให้ตัดเป็นชิ้นย่อยตามความกว้าง
			if getWidth(w) > colWidth {
				runes := []rune(w)
				chunk := ""
				for _, r := range runes {
					if getWidth(chunk+string(r)) > colWidth && chunk != "" {
						safeWords = append(safeWords, chunk)
						chunk = string(r)
					} else {
						chunk += string(r)
					}
				}
				if chunk != "" {
					safeWords = append(safeWords, chunk)
				}
			} else {
				safeWords = append(safeWords, w)
			}
		}

		currentLine := ""
		for _, w := range safeWords {
			testLine := w
			if currentLine != "" {
				testLine = currentLine + " " + w
			}
			if getWidth(testLine) <= colWidth {
				currentLine = testLine
			} else {
				if currentLine != "" {
					wrappedLines = append(wrappedLines, currentLine)
				}
				currentLine = w
			}
		}
		if currentLine != "" {
			wrappedLines = append(wrappedLines, currentLine)
		}
	}

	if len(wrappedLines) == 0 {
		wrappedLines = append(wrappedLines, text)
	}

	return wrappedLines
}

func calcSaleOrderItemLayout(m pdf.Maroto, productName string, specsLine string) (float64, float64) {
	pageWidth, _ := m.GetPageSize()
	leftMargin, _, rightMargin, _ := m.GetPageMargins()
	columnWidth := (pageWidth - leftMargin - rightMargin) * (4.0 / 12.0)

	nameLines := wrapTextToLines(m, productName, "THSarabun", "B", 10.0, columnWidth)
	var specLines []string
	if specsLine != "" {
		specLines = wrapTextToLines(m, specsLine, "THSarabun", "", 8.5, columnWidth)
	}

	totalNameHeight := float64(len(nameLines)) * 4.0
	specsTop := 0.5 + totalNameHeight
	var rowHeight float64
	if len(specLines) == 0 {
		rowHeight = math.Max(7.5, specsTop+2.5)
	} else {
		specsHeight := float64(len(specLines)) * 3.5
		rowHeight = math.Max(11.0, specsTop+specsHeight+2.5)
	}

	return rowHeight, specsTop
}

