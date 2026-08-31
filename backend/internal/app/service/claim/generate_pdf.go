package claim

import (
	"context"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

func (s *customerClaimService) GenerateCustomerClaimPDF(ctx context.Context, claimID uint) ([]byte, error) {
	// 1. ดึงข้อมูลใบเคลมจาก Database
	claim, err := s.repo.GetCustomerClaimByID(claimID)
	if err != nil {
		return nil, fmt.Errorf("could not find claim with ID %d: %v", claimID, err)
	}

	companyData, err := s.repo.GetCompanySetting()
	if err != nil {
		companyData = nil
	}

	// 2. ตั้งค่าหน้ากระดาษและฟอนต์ภาษาไทย
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	claimDateStr := claim.ClaimDate.Format("02/01/2006 15:04")
	if claim.ClaimDate.IsZero() {
		claimDateStr = time.Now().Format("02/01/2006 15:04")
	}

	// 3. ส่วนหัวเอกสาร
	m.RegisterHeader(func() {
		m.Row(24, func() {
			m.Col(3, func() {
				if companyData != nil && companyData.LogoURL != "" {
					_ = m.FileImage(companyData.LogoURL, props.Rect{
						Percent: 350,
						Center:  false,
					})
				}
			})
			m.Col(4, func() {}) // ช่องว่าง
			m.Col(5, func() {
				m.Text("ใบรับเคลมสินค้า", props.Text{
					Size:  22,
					Style: consts.Bold,
					Align: consts.Right,
					Color: hexToColor("#E51C23"),
				})
				m.Text("CUSTOMER CLAIM RECEIPT", props.Text{
					Size:  10,
					Style: consts.Bold,
					Align: consts.Right,
					Top:   8,
					Color: hexToColor("#555555"),
				})
			})
		})
	})

	m.Row(4, func() {})

	// 4. ข้อมูลร้านค้า (ซ้าย) และ ข้อมูลเลขที่เอกสาร (ขวา)
	m.Row(24, func() {
		m.Col(7, func() {
			compName := "AutoParts Retail Management"
			compAddr := "123 ถนนมิตรภาพ ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000"
			compPhone := "043-123456"
			compEmail := "contact@autoparts.com"
			compTax := "0105559999999"

			if companyData != nil {
				if companyData.CompanyName != "" { compName = companyData.CompanyName }
				if companyData.Address != "" { compAddr = companyData.Address }
				if companyData.PhoneNumber != "" { compPhone = companyData.PhoneNumber }
				if companyData.Email != "" { compEmail = companyData.Email }
				if companyData.TaxIDNumber != "" { compTax = companyData.TaxIDNumber }
			}

			m.Text(compName, props.Text{Size: 12, Style: consts.Bold})
			m.Text(compAddr, props.Text{Size: 10, Top: 4.5})
			m.Text(fmt.Sprintf("โทร: %s | อีเมล: %s", compPhone, compEmail), props.Text{Size: 10, Top: 9})
			m.Text(fmt.Sprintf("เลขประจำตัวผู้เสียภาษี: %s", compTax), props.Text{Size: 10, Top: 13.5})
		})

		m.Col(2, func() {
			m.Text("เลขที่ใบเคลม:", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Color: hexToColor("#E51C23")})
			m.Text("วันที่แจ้งเคลม:", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 4.5, Color: hexToColor("#E51C23")})
			m.Text("สถานะการเคลม:", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 9, Color: hexToColor("#E51C23")})
			m.Text("พนักงานรับเรื่อง:", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Right, Top: 13.5, Color: hexToColor("#E51C23")})
		})

		m.Col(3, func() {
			creatorName := "-"
			if claim.CreatedByUser != nil {
				creatorName = strings.TrimSpace(claim.CreatedByUser.FirstName + " " + claim.CreatedByUser.LastName)
				if creatorName == "" {
					creatorName = claim.CreatedByUser.Username
				}
			}

			statusText := claim.Status
			if statusText == "" {
				statusText = "รอดำเนินการ (PENDING)"
			}

			m.Text(claim.ClaimNo, props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Left})
			m.Text(claimDateStr, props.Text{Size: 10.5, Align: consts.Left, Top: 4.5})
			m.Text(statusText, props.Text{Size: 10.5, Align: consts.Left, Top: 9})
			m.Text(creatorName, props.Text{Size: 10.5, Align: consts.Left, Top: 13.5})
		})
	})

	m.Row(3, func() {})
	m.Line(0.8)
	m.Row(2, func() {})

	// 5. ข้อมูลลูกค้า (Customer Section)
	custName := claim.CustomerName
	custPhone := claim.CustomerPhone
	orderRef := "-"

	if claim.OriginalOrder != nil {
		orderRef = claim.OriginalOrder.OrderNumber
		if custName == "" || custName == "-" {
			if claim.OriginalOrder.Customer.CustomerName != "" {
				custName = claim.OriginalOrder.Customer.CustomerName
			} else if claim.OriginalOrder.CustomerNameTemp != nil && *claim.OriginalOrder.CustomerNameTemp != "" {
				custName = *claim.OriginalOrder.CustomerNameTemp
			}
		}
		if custPhone == "" || custPhone == "-" {
			if claim.OriginalOrder.Customer.PhoneNumber != "" {
				custPhone = claim.OriginalOrder.Customer.PhoneNumber
			} else if claim.OriginalOrder.CustomerPhoneTemp != nil && *claim.OriginalOrder.CustomerPhoneTemp != "" {
				custPhone = *claim.OriginalOrder.CustomerPhoneTemp
			}
		}
	}
	if custName == "" { custName = "-" }
	if custPhone == "" { custPhone = "-" }

	m.Row(14, func() {
		m.Col(6, func() {
			m.Text("ข้อมูลลูกค้า (CUSTOMER INFORMATION)", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#1E293B")})
			m.Text(fmt.Sprintf("ชื่อลูกค้า: %s", custName), props.Text{Size: 10.5, Top: 4.5})
			m.Text(fmt.Sprintf("เบอร์โทรศัพท์: %s", custPhone), props.Text{Size: 10.5, Top: 9})
		})
		m.Col(6, func() {
			m.Text("ข้อมูลอ้างอิงการขาย (REFERENCE)", props.Text{Size: 11, Style: consts.Bold, Color: hexToColor("#1E293B")})
			m.Text(fmt.Sprintf("อ้างอิงเลขที่บิลขาย (Order No): %s", orderRef), props.Text{Size: 10.5, Top: 4.5})
			claimType := claim.ClaimType
			if claimType == "" { claimType = "เปลี่ยน/ส่งซ่อมสินค้า" }
			m.Text(fmt.Sprintf("ประเภทการเคลม: %s", claimType), props.Text{Size: 10.5, Top: 9})
		})
	})

	m.Row(3, func() {})

	// 6. ตารางรายการสินค้าที่เคลม (Table Header)
	m.Line(1)
	m.Row(7, func() {
		m.Col(1, func() { m.Text("ลำดับ", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("รหัสสินค้า", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Left}) })
		m.Col(3, func() { m.Text("ชื่อสินค้า / รายละเอียด", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Left}) })
		m.Col(1, func() { m.Text("จำนวน", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("ประเภท", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Center}) })
		m.Col(3, func() { m.Text("สาเหตุ / อาการเสียที่ลูกค้าแจ้ง", props.Text{Size: 10.5, Style: consts.Bold, Align: consts.Left}) })
	})
	m.Line(1)

	// 7. ข้อมูลรายการสินค้า (Table Rows)
	hasEvidencePhotos := false
	if len(claim.Items) == 0 {
		m.Row(8, func() {
			m.Col(12, func() {
				m.Text("ไม่พบรายการสินค้าที่เคลม", props.Text{Size: 10.5, Align: consts.Center, Style: consts.Italic})
			})
		})
	} else {
		for idx, item := range claim.Items {
			if strings.TrimSpace(item.EvidenceURL) != "" {
				hasEvidencePhotos = true
			}

			pCode := "-"
			pName := fmt.Sprintf("สินค้า ID: %d", item.ProductID)
			if item.Product != nil {
				if item.Product.Product_Code != "" { pCode = item.Product.Product_Code }
				if item.Product.Product_Name != "" { pName = item.Product.Product_Name }
			}

			reason := item.Reason
			if reason == "" { reason = "-" }

			itemType := item.ClaimType
			if itemType == "INSTANT" {
				itemType = "เปลี่ยนทันที"
			} else if itemType == "SUPPLIER" || itemType == "SUPPLIER_CLAIM" {
				itemType = "ส่งซัพพลายเออร์"
			} else if itemType == "REFUND" {
				itemType = "คืนเงิน"
			} else if itemType == "" {
				itemType = "-"
			}

			m.Row(8, func() {
				m.Col(1, func() { m.Text(fmt.Sprintf("%d", idx+1), props.Text{Size: 10, Align: consts.Center}) })
				m.Col(2, func() { m.Text(sanitizeTextForPDF(pCode), props.Text{Size: 10, Align: consts.Left}) })
				m.Col(3, func() { m.Text(sanitizeTextForPDF(pName), props.Text{Size: 10, Align: consts.Left}) })
				m.Col(1, func() { m.Text(fmt.Sprintf("%d", item.Qty), props.Text{Size: 10, Align: consts.Center}) })
				m.Col(2, func() { m.Text(sanitizeTextForPDF(itemType), props.Text{Size: 9.5, Align: consts.Center}) })
				m.Col(3, func() { m.Text(sanitizeTextForPDF(reason), props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Left, Color: hexToColor("#991B1B")}) })
			})
		}
	}

	m.Line(1)
	m.Row(4, func() {})

	// 8. แสดงส่วนรูปภาพหลักฐานความเสียหาย (ถ้ามีการแนบภาพ)
	if hasEvidencePhotos {
		m.Row(7, func() {
			m.Col(12, func() {
				m.Text("[ ภาพถ่ายหลักฐานสินค้าชำรุด (DEFECT EVIDENCE PHOTOS) ]", props.Text{
					Size:  10.5,
					Style: consts.Bold,
					Color: hexToColor("#E51C23"),
				})
			})
		})

		for idx, item := range claim.Items {
			if strings.TrimSpace(item.EvidenceURL) == "" {
				continue
			}

			pName := fmt.Sprintf("รายการที่ %d", idx+1)
			if item.Product != nil && item.Product.Product_Name != "" {
				pName = fmt.Sprintf("รายการที่ %d: %s", idx+1, item.Product.Product_Name)
			}

			filePath, base64Data, ext, err := loadEvidenceImage(item.EvidenceURL)
			if err == nil {
				m.Row(32, func() {
					m.Col(4, func() {
						if filePath != "" {
							_ = m.FileImage(filePath, props.Rect{
								Percent: 90,
								Center:  false,
							})
						} else if base64Data != "" {
							_ = m.Base64Image(base64Data, ext, props.Rect{
								Percent: 90,
								Center:  false,
							})
						}
					})
					m.Col(8, func() {
						m.Text(sanitizeTextForPDF(pName), props.Text{Size: 10, Style: consts.Bold, Top: 2})
						m.Text(sanitizeTextForPDF(fmt.Sprintf("อาการที่พบ: %s", item.Reason)), props.Text{Size: 9.5, Top: 7, Color: hexToColor("#444444")})
						m.Text(sanitizeTextForPDF(fmt.Sprintf("ประเภทเคลม: %s | จำนวน: %d ชิ้น", item.ClaimType, item.Qty)), props.Text{Size: 9, Top: 12, Color: hexToColor("#666666")})
					})
				})
				m.Row(2, func() {})
			}
		}
		m.Line(0.5)
		m.Row(3, func() {})
	}

	// 9. หมายเหตุ & เงื่อนไขการรับเคลม
	m.Row(18, func() {
		m.Col(7, func() {
			m.Text("เงื่อนไขการรับประกันและข้อกำหนดการเคลม:", props.Text{Size: 10, Style: consts.Bold, Color: hexToColor("#E51C23")})
			m.Text("1. กรุณาเก็บใบรับเคลมนี้ไว้เป็นหลักฐานเพื่อใช้แสดงตัวตนในการรับสินค้าหรือติดตามสถานะ", props.Text{Size: 9, Top: 4})
			m.Text("2. สินค้าที่นำมาเคลมต้องอยู่ในเงื่อนไขการรับประกัน ไม่แตก หัก บิ่น ไหม้ หรือดัดแปลงสภาพ", props.Text{Size: 9, Top: 7.5})
			m.Text("3. ทางร้านจะติดต่อกลับผ่านเบอร์โทรศัพท์ที่ระบุไว้เมื่อผลการเคลมได้รับการอนุมัติเสร็จสิ้น", props.Text{Size: 9, Top: 11})
			if claim.Note != "" {
				m.Text(fmt.Sprintf("หมายเหตุเพิ่มเติม: %s", claim.Note), props.Text{Size: 9, Style: consts.Bold, Top: 14.5})
			}
		})

		m.Col(5, func() {
			// สรุปยอดเงิน (ถ้ามี)
			if claim.ClaimAmount > 0 || claim.RefundAmount > 0 {
				m.Text("สรุปยอดการเคลม:", props.Text{Size: 10, Style: consts.Bold})
				if claim.ClaimAmount > 0 {
					m.Text(fmt.Sprintf("มูลค่าสินค้าเคลม: ฿%s", fmtCurrency(claim.ClaimAmount)), props.Text{Size: 9.5, Top: 4.5, Align: consts.Right})
				}
				if claim.RefundAmount > 0 {
					m.Text(fmt.Sprintf("ยอดเงินคืนลูกค้า: ฿%s", fmtCurrency(claim.RefundAmount)), props.Text{Size: 9.5, Top: 8.5, Align: consts.Right})
				}
			}
		})
	})

	// 10. Generate PDF binary buffer
	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate claim PDF: %v", err)
	}

	return buf.Bytes(), nil
}

func (s *customerClaimService) GenerateCustomerClaimChecklistPDF(ctx context.Context, status string, search string) ([]byte, error) {
	claims, err := s.repo.ListCustomerClaims()
	if err != nil {
		return nil, fmt.Errorf("could not list claims: %v", err)
	}

	companyData, err := s.repo.GetCompanySetting()
	if err != nil {
		companyData = nil
	}

	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	nowStr := time.Now().Format("02/01/2006 15:04")

	type ChecklistRow struct {
		ClaimNo       string
		ClaimDate     string
		CustomerName  string
		CustomerPhone string
		ProductName   string
		ProductCode   string
		Qty           uint
		Reason        string
		ItemStatus    string
		ClaimType     string
		EvidenceURL   string
	}

	var rows []ChecklistRow
	searchLower := strings.ToLower(strings.TrimSpace(search))
	targetStatus := strings.ToUpper(strings.TrimSpace(status))
	if targetStatus == "" {
		targetStatus = "APPROVED" // ค่าเริ่มต้นพิมพ์เฉพาะที่อนุมัติแล้ว
	}

	for _, c := range claims {
		cDate := c.ClaimDate.Format("02/01/2006")
		cName := c.CustomerName
		cPhone := c.CustomerPhone
		if c.OriginalOrder != nil {
			if cName == "" || cName == "-" {
				if c.OriginalOrder.Customer.CustomerName != "" {
					cName = c.OriginalOrder.Customer.CustomerName
				} else if c.OriginalOrder.CustomerNameTemp != nil && *c.OriginalOrder.CustomerNameTemp != "" {
					cName = *c.OriginalOrder.CustomerNameTemp
				}
			}
			if cPhone == "" || cPhone == "-" {
				if c.OriginalOrder.Customer.PhoneNumber != "" {
					cPhone = c.OriginalOrder.Customer.PhoneNumber
				} else if c.OriginalOrder.CustomerPhoneTemp != nil && *c.OriginalOrder.CustomerPhoneTemp != "" {
					cPhone = *c.OriginalOrder.CustomerPhoneTemp
				}
			}
		}
		if cName == "" { cName = "-" }
		if cPhone == "" { cPhone = "-" }

		for _, item := range c.Items {
			iStatus := strings.ToUpper(item.Status)
			if iStatus == "" {
				iStatus = strings.ToUpper(c.Status)
			}

			if targetStatus != "ALL" && iStatus != targetStatus {
				continue
			}

			pName := fmt.Sprintf("สินค้า ID: %d", item.ProductID)
			pCode := "-"
			if item.Product != nil {
				if item.Product.Product_Name != "" { pName = item.Product.Product_Name }
				if item.Product.Product_Code != "" { pCode = item.Product.Product_Code }
			}

			if searchLower != "" {
				match := strings.Contains(strings.ToLower(c.ClaimNo), searchLower) ||
					strings.Contains(strings.ToLower(cName), searchLower) ||
					strings.Contains(strings.ToLower(cPhone), searchLower) ||
					strings.Contains(strings.ToLower(pName), searchLower) ||
					strings.Contains(strings.ToLower(pCode), searchLower)
				if !match {
					continue
				}
			}

			rows = append(rows, ChecklistRow{
				ClaimNo:       c.ClaimNo,
				ClaimDate:     cDate,
				CustomerName:  cName,
				CustomerPhone: cPhone,
				ProductName:   pName,
				ProductCode:   pCode,
				Qty:           item.Qty,
				Reason:        item.Reason,
				ItemStatus:    iStatus,
				ClaimType:     item.ClaimType,
				EvidenceURL:   item.EvidenceURL,
			})
		}
	}

	// Header
	m.RegisterHeader(func() {
		m.Row(22, func() {
			m.Col(3, func() {
				if companyData != nil && companyData.LogoURL != "" {
					_ = m.FileImage(companyData.LogoURL, props.Rect{
						Percent: 320,
						Center:  false,
					})
				}
			})
			m.Col(3, func() {})
			m.Col(6, func() {
				m.Text("ใบรายงานเช็คลิสต์รายการเคลมสินค้า", props.Text{
					Size:  18,
					Style: consts.Bold,
					Align: consts.Right,
					Color: hexToColor("#E51C23"),
				})
				m.Text("CLAIM CHECKLIST & VERIFICATION REPORT", props.Text{
					Size:  9.5,
					Style: consts.Bold,
					Align: consts.Right,
					Top:   7,
					Color: hexToColor("#555555"),
				})
			})
		})
	})

	m.Row(3, func() {})

	// Meta info row
	m.Row(16, func() {
		m.Col(7, func() {
			compName := "AutoParts Retail Management"
			if companyData != nil && companyData.CompanyName != "" { compName = companyData.CompanyName }
			m.Text(compName, props.Text{Size: 11, Style: consts.Bold})
			statusLabel := "เฉพาะรายการที่อนุมัติแล้ว (APPROVED)"
			if targetStatus == "ALL" {
				statusLabel = "ทุกสถานะ (ALL)"
			} else if targetStatus == "PENDING" {
				statusLabel = "รอดำเนินการ (PENDING)"
			} else if targetStatus == "REJECTED" {
				statusLabel = "ปฏิเสธการเคลม (REJECTED)"
			}
			m.Text(fmt.Sprintf("เงื่อนไขรายงาน: %s", statusLabel), props.Text{Size: 9.5, Top: 4.5, Color: hexToColor("#333333")})
			m.Text(fmt.Sprintf("รวมทั้งหมด: %d รายการ", len(rows)), props.Text{Size: 9.5, Style: consts.Bold, Top: 9, Color: hexToColor("#E51C23")})
		})
		m.Col(5, func() {
			m.Text("วันที่พิมพ์รายงาน:", props.Text{Size: 9.5, Style: consts.Bold, Align: consts.Right})
			m.Text(nowStr, props.Text{Size: 9.5, Align: consts.Right, Top: 4.5})
		})
	})

	m.Row(3, func() {})

	// Table Header
	m.Line(1)
	m.Row(7, func() {
		m.Col(1, func() { m.Text("ตรวจ", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("เลขที่ใบเคลม / วันที่", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
		m.Col(2, func() { m.Text("ลูกค้า / เบอร์โทร", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
		m.Col(3, func() { m.Text("รายการสินค้าอะไหล่", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
		m.Col(1, func() { m.Text("จำนวน", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
		m.Col(1, func() { m.Text("รูปหลักฐาน", props.Text{Size: 10, Style: consts.Bold, Align: consts.Center}) })
		m.Col(2, func() { m.Text("สาเหตุ / อาการเสีย", props.Text{Size: 10, Style: consts.Bold, Align: consts.Left}) })
	})
	m.Line(1)

	// Table Content
	if len(rows) == 0 {
		m.Row(10, func() {
			m.Col(12, func() {
				m.Text("ไม่พบรายการเคลมสินค้าตามเงื่อนไขที่เลือก", props.Text{Size: 10.5, Align: consts.Center, Style: consts.Italic})
			})
		})
	} else {
		for _, r := range rows {
			reason := r.Reason
			if reason == "" { reason = "-" }

			filePath, base64Data, ext, imgErr := loadEvidenceImage(r.EvidenceURL)
			hasImage := (imgErr == nil && (filePath != "" || base64Data != ""))

			if hasImage {
				// แถวที่มีรูปภาพหลักฐาน
				m.Row(22, func() {
					m.Col(1, func() {
						m.Text("[   ]", props.Text{Size: 10, Align: consts.Center, Style: consts.Bold, Color: hexToColor("#888888"), Top: 6})
					})
					m.Col(2, func() {
						m.Text(sanitizeTextForPDF(r.ClaimNo), props.Text{Size: 9.5, Style: consts.Bold, Top: 3})
						m.Text(r.ClaimDate, props.Text{Size: 8.5, Top: 8.5, Color: hexToColor("#666666")})
					})
					m.Col(2, func() {
						m.Text(sanitizeTextForPDF(r.CustomerName), props.Text{Size: 9.5, Style: consts.Bold, Top: 3})
						if r.CustomerPhone != "-" {
							m.Text(fmt.Sprintf("โทร. %s", r.CustomerPhone), props.Text{Size: 8.5, Top: 8.5, Color: hexToColor("#0284C7")})
						}
					})
					m.Col(3, func() {
						m.Text(sanitizeTextForPDF(r.ProductName), props.Text{Size: 9.5, Top: 3})
						if r.ProductCode != "-" {
							m.Text(fmt.Sprintf("รหัส: %s", r.ProductCode), props.Text{Size: 8, Top: 8.5, Color: hexToColor("#666666")})
						}
					})
					m.Col(1, func() {
						m.Text(fmt.Sprintf("%d", r.Qty), props.Text{Size: 10, Align: consts.Center, Style: consts.Bold, Top: 6})
					})
					m.Col(1, func() {
						if filePath != "" {
							_ = m.FileImage(filePath, props.Rect{
								Percent: 85,
								Center:  true,
								Top:     1,
							})
						} else if base64Data != "" {
							_ = m.Base64Image(base64Data, ext, props.Rect{
								Percent: 85,
								Center:  true,
								Top:     1,
							})
						}
					})
					m.Col(2, func() {
						m.Text(sanitizeTextForPDF(reason), props.Text{Size: 9, Style: consts.Bold, Top: 3, Color: hexToColor("#B91C1C")})
					})
				})
			} else {
				// แถวที่ไม่มีรูป
				m.Row(10, func() {
					m.Col(1, func() {
						m.Text("[   ]", props.Text{Size: 10, Align: consts.Center, Style: consts.Bold, Color: hexToColor("#888888"), Top: 2})
					})
					m.Col(2, func() {
						m.Text(sanitizeTextForPDF(r.ClaimNo), props.Text{Size: 9.5, Style: consts.Bold, Top: 1})
						m.Text(r.ClaimDate, props.Text{Size: 8.5, Top: 5.5, Color: hexToColor("#666666")})
					})
					m.Col(2, func() {
						m.Text(sanitizeTextForPDF(r.CustomerName), props.Text{Size: 9.5, Style: consts.Bold, Top: 1})
						if r.CustomerPhone != "-" {
							m.Text(fmt.Sprintf("โทร. %s", r.CustomerPhone), props.Text{Size: 8.5, Top: 5.5, Color: hexToColor("#0284C7")})
						}
					})
					m.Col(3, func() {
						m.Text(sanitizeTextForPDF(r.ProductName), props.Text{Size: 9.5, Top: 1})
						if r.ProductCode != "-" {
							m.Text(fmt.Sprintf("รหัส: %s", r.ProductCode), props.Text{Size: 8, Top: 5.5, Color: hexToColor("#666666")})
						}
					})
					m.Col(1, func() {
						m.Text(fmt.Sprintf("%d", r.Qty), props.Text{Size: 10, Align: consts.Center, Style: consts.Bold, Top: 2})
					})
					m.Col(1, func() {
						m.Text("-", props.Text{Size: 9, Align: consts.Center, Top: 2, Color: hexToColor("#999999")})
					})
					m.Col(2, func() {
						m.Text(sanitizeTextForPDF(reason), props.Text{Size: 9, Top: 1, Color: hexToColor("#B91C1C")})
					})
				})
			}
		}
	}

	m.Line(1)

	buf, err := m.Output()
	if err != nil {
		return nil, fmt.Errorf("could not generate checklist PDF: %v", err)
	}

	return buf.Bytes(), nil
}

func loadEvidenceImage(urlOrPath string) (filePath string, base64Data string, ext consts.Extension, err error) {
	urlOrPath = strings.TrimSpace(urlOrPath)
	if urlOrPath == "" {
		return "", "", consts.Jpg, fmt.Errorf("empty url")
	}

	ext = consts.Jpg
	if strings.HasSuffix(strings.ToLower(urlOrPath), ".png") {
		ext = consts.Png
	}

	// 1. Remote HTTP/HTTPS URL
	if strings.HasPrefix(urlOrPath, "http://") || strings.HasPrefix(urlOrPath, "https://") {
		client := http.Client{Timeout: 3 * time.Second}
		resp, err := client.Get(urlOrPath)
		if err != nil {
			return "", "", ext, err
		}
		defer resp.Body.Close()
		data, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", "", ext, err
		}
		return "", base64.StdEncoding.EncodeToString(data), ext, nil
	}

	// 2. Local File path
	cleanPath := strings.TrimPrefix(urlOrPath, "/")
	if _, err := os.Stat(cleanPath); err == nil {
		return cleanPath, "", ext, nil
	}
	if _, err := os.Stat("backend/" + cleanPath); err == nil {
		return "backend/" + cleanPath, "", ext, nil
	}
	if _, err := os.Stat("uploads/" + cleanPath); err == nil {
		return "uploads/" + cleanPath, "", ext, nil
	}

	return "", "", ext, fmt.Errorf("file not found: %s", urlOrPath)
}

func fmtCurrency(amount float64) string {
	return fmt.Sprintf("%.2f", amount)
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

func sanitizeTextForPDF(s string) string {
	var b strings.Builder
	for _, r := range s {
		if r <= 0xFFFF {
			b.WriteRune(r)
		}
	}
	return b.String()
}

