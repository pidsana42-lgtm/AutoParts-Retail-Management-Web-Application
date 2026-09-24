package purchaseorders

import (
	"bytes"
	"context"
	"encoding/base64"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	"image/png"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
	"github.com/johnfercher/maroto/pkg/pdf"
	"github.com/johnfercher/maroto/pkg/props"
)

const (
	poPDFGridColumns       = 12.0
	poPDFItemBaseRowHeight = 7.0
	poPDFItemLineHeight    = 4.5
	poPDFItemFontSize      = 11.0
)

func (s *purchaseOrderService) GeneratePOPDF(ctx context.Context, poID uint, includeCode bool, printedBy uint) ([]byte, error) {
	// 1. ดึงข้อมูลจริงจาก Database
	poData, err := s.poRepository.GetPOForPDF(ctx, poID)
	if err != nil {
		return nil, fmt.Errorf("could not get PO data: %v", err)
	}

	companyData, err := s.poRepository.GetCompanySetting(ctx)
	if err != nil {
		return nil, fmt.Errorf("could not get company data: %v", err)
	}
	printer, err := s.userRepo.FindByID(ctx, printedBy)
	if err != nil {
		return nil, fmt.Errorf("could not get printing user: %v", err)
	}
	printerName := strings.TrimSpace(printer.FirstName + " " + printer.LastName)
	if printerName == "" {
		printerName = strings.TrimSpace(printer.Username)
	}
	if printerName == "" {
		printerName = "-"
	}

	// 2. ตั้งค่าหน้ากระดาษและฟอนต์
	m := pdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, "assets/fonts/THSarabunNew.ttf")
	m.AddUTF8Font("THSarabun", consts.Bold, "assets/fonts/THSarabunNew Bold.ttf")
	m.SetDefaultFontFamily("THSarabun")

	printDate := time.Now().In(time.FixedZone("Asia/Bangkok", 7*60*60)).Format("02/01/2006")
	logoPath, logoBase64, logoExtension, _ := loadPOLogo(ctx, companyData.LogoURL)

	// 3. ส่วนหัวเอกสาร (ลดขนาด Row ลงให้ดูกระชับ)
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
			m.Text(printDate, props.Text{Size: 11, Align: consts.Left, Top: 5})
			m.Text(printerName, props.Text{Size: 11, Align: consts.Left, Top: 10})
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
		if includeCode {
			m.Col(2, func() {
				m.Text("รหัส Supplier", props.Text{Size: 9, Style: consts.Bold, Align: consts.Left})
			})
		}
		m.Col(2, func() {
			m.Text("Part Number", props.Text{Size: 9, Style: consts.Bold, Align: consts.Left})
		})
		productNameCol := uint(4)
		if includeCode {
			productNameCol = 2
		}
		m.Col(productNameCol, func() {
			m.Text("ชื่อสินค้า", props.Text{Size: 11, Style: consts.Bold, Align: consts.Left})
		})
		m.Col(2, func() {
			m.Text("จำนวนต่อหน่วย  ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right})
		})
		m.Col(2, func() { m.Text("หน่วย  ", props.Text{Size: 11, Style: consts.Bold, Align: consts.Right}) })
	})

	// วาดเส้นขอบล่างของ Header
	m.Line(1)

	// วนลูปข้อมูลสินค้า (Content)
	for i, item := range poData.PO_Items {
		supplierProductCode := strings.TrimSpace(item.Supply_product_code_snapshot)
		if supplierProductCode == "" {
			supplierProductCode = "-"
		}

		partNumber := "-"
		if item.Product != nil && strings.TrimSpace(item.Product.Part_Number) != "" {
			partNumber = strings.TrimSpace(item.Product.Part_Number)
		}
		poType := "สั่งซื้อ"
		if item.PreOrderItemID != nil {
			poType = "พรีออเดอร์"
		}

		productNameCol := uint(4)
		if includeCode {
			productNameCol = 2
		}
		rowHeight := poPDFItemRowHeight(m, item.Product_name_snapshot, productNameCol)

		m.Row(rowHeight, func() {
			m.Col(1, func() { m.Text(fmt.Sprintf("%d", i+1), props.Text{Size: 11, Align: consts.Center}) })
			m.Col(1, func() { m.Text(poType, props.Text{Size: 11, Align: consts.Left}) })
			if includeCode {
				m.Col(2, func() { m.Text(supplierProductCode, props.Text{Size: 10, Align: consts.Left}) })
			}
			m.Col(2, func() { m.Text(partNumber, props.Text{Size: 10, Align: consts.Left}) })
			m.Col(productNameCol, func() { m.Text(item.Product_name_snapshot, props.Text{Size: 11}) })
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

func poPDFItemRowHeight(m pdf.Maroto, productName string, productNameCol uint) float64 {
	document, ok := m.(*pdf.PdfMaroto)
	if !ok || productNameCol == 0 {
		return poPDFItemBaseRowHeight
	}

	pageWidth, _ := m.GetPageSize()
	leftMargin, _, rightMargin, _ := m.GetPageMargins()
	columnWidth := (pageWidth - leftMargin - rightMargin) * float64(productNameCol) / poPDFGridColumns
	textProps := props.Text{
		Family: "THSarabun",
		Style:  consts.Normal,
		Size:   poPDFItemFontSize,
	}
	lineCount := document.TextHelper.GetLinesQuantity(strings.TrimSpace(productName), textProps, columnWidth)
	if lineCount <= 1 {
		return poPDFItemBaseRowHeight
	}

	return poPDFItemBaseRowHeight + float64(lineCount-1)*poPDFItemLineHeight
}

// --------------------------------------------------------

const maxPOLogoBytes = 5 * 1024 * 1024

// loadPOLogo prepares both local and remote company logos for Maroto. Remote
// images (such as Supabase public URLs) must be downloaded before PDF rendering.
func loadPOLogo(ctx context.Context, logoURL string) (filePath string, base64Data string, extension consts.Extension, err error) {
	logoURL = strings.TrimSpace(logoURL)
	if logoURL == "" {
		return "", "", consts.Png, nil
	}

	if !strings.HasPrefix(logoURL, "http://") && !strings.HasPrefix(logoURL, "https://") {
		filePath = resolvePOLogoPath(logoURL)
		if filePath == "" {
			return "", "", consts.Png, fmt.Errorf("logo file not found: %s", logoURL)
		}

		data, readErr := os.ReadFile(filePath)
		if readErr != nil {
			return "", "", consts.Png, readErr
		}
		prepared, ext, converted, prepareErr := preparePOLogoImage(data)
		if prepareErr != nil {
			return "", "", consts.Png, prepareErr
		}
		if converted {
			return "", base64.StdEncoding.EncodeToString(prepared), ext, nil
		}
		return filePath, "", ext, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, logoURL, nil)
	if err != nil {
		return "", "", consts.Png, err
	}
	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", "", consts.Png, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", "", consts.Png, fmt.Errorf("logo request returned HTTP %d", resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxPOLogoBytes+1))
	if err != nil {
		return "", "", consts.Png, err
	}
	if len(data) > maxPOLogoBytes {
		return "", "", consts.Png, fmt.Errorf("logo exceeds %d bytes", maxPOLogoBytes)
	}

	prepared, ext, _, err := preparePOLogoImage(data)
	if err != nil {
		return "", "", consts.Png, err
	}
	return "", base64.StdEncoding.EncodeToString(prepared), ext, nil
}

// Maroto supports JPEG and PNG. GIF logos are converted to PNG using the first frame.
func preparePOLogoImage(data []byte) (prepared []byte, extension consts.Extension, converted bool, err error) {
	switch http.DetectContentType(data) {
	case "image/png":
		return data, consts.Png, false, nil
	case "image/jpeg":
		return data, consts.Jpg, false, nil
	case "image/gif":
		img, _, decodeErr := image.Decode(bytes.NewReader(data))
		if decodeErr != nil {
			return nil, consts.Png, false, decodeErr
		}
		var convertedImage bytes.Buffer
		if encodeErr := png.Encode(&convertedImage, img); encodeErr != nil {
			return nil, consts.Png, false, encodeErr
		}
		return convertedImage.Bytes(), consts.Png, true, nil
	default:
		return nil, consts.Png, false, fmt.Errorf("unsupported logo image format")
	}
}

func resolvePOLogoPath(logoURL string) string {
	logoPath := strings.TrimSpace(logoURL)
	if logoPath == "" || strings.HasPrefix(logoPath, "http://") || strings.HasPrefix(logoPath, "https://") {
		return ""
	}

	// Local upload URLs are stored for browser access as /uploads/<file>.
	// PDF generation needs the corresponding filesystem path instead.
	if strings.HasPrefix(filepath.ToSlash(logoPath), "/uploads/") {
		logoPath = strings.TrimLeft(logoPath, `/\\`)
	}
	logoPath = filepath.Clean(filepath.FromSlash(logoPath))

	candidates := []string{logoPath}
	if !filepath.IsAbs(logoPath) {
		candidates = append(candidates, filepath.Join("backend", logoPath))
	}

	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && !info.IsDir() {
			return candidate
		}
	}
	return ""
}

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
