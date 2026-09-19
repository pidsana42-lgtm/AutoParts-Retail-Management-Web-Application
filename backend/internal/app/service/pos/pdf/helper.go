package pdf

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
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"backend/internal/app/entity"

	"github.com/johnfercher/maroto/pkg/color"
	"github.com/johnfercher/maroto/pkg/consts"
)

const maxLogoBytes = 5 * 1024 * 1024

// LoadLogo prepares both local and remote company logos for Maroto. Remote
// images (such as Supabase public URLs) must be downloaded before PDF rendering.
func LoadLogo(ctx context.Context, logoURL string) (filePath string, base64Data string, extension consts.Extension, err error) {
	logoURL = strings.TrimSpace(logoURL)
	if logoURL == "" {
		return "", "", consts.Png, nil
	}

	if ctx == nil {
		ctx = context.Background()
	}

	if !strings.HasPrefix(logoURL, "http://") && !strings.HasPrefix(logoURL, "https://") {
		filePath = ResolveLogoPath(logoURL)
		if filePath == "" {
			return "", "", consts.Png, fmt.Errorf("logo file not found: %s", logoURL)
		}

		data, readErr := os.ReadFile(filePath)
		if readErr != nil {
			return "", "", consts.Png, readErr
		}
		prepared, ext, converted, prepareErr := PrepareLogoImage(data)
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
	data, err := io.ReadAll(io.LimitReader(resp.Body, maxLogoBytes+1))
	if err != nil {
		return "", "", consts.Png, err
	}
	if len(data) > maxLogoBytes {
		return "", "", consts.Png, fmt.Errorf("logo exceeds %d bytes", maxLogoBytes)
	}

	prepared, ext, _, err := PrepareLogoImage(data)
	if err != nil {
		return "", "", consts.Png, err
	}
	return "", base64.StdEncoding.EncodeToString(prepared), ext, nil
}

func loadLogo(ctx context.Context, logoURL string) (filePath string, base64Data string, extension consts.Extension, err error) {
	return LoadLogo(ctx, logoURL)
}

// PrepareLogoImage converts supported image formats (PNG, JPEG, GIF) for Maroto. GIF logos are converted to PNG.
func PrepareLogoImage(data []byte) (prepared []byte, extension consts.Extension, converted bool, err error) {
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

func prepareLogoImage(data []byte) (prepared []byte, extension consts.Extension, converted bool, err error) {
	return PrepareLogoImage(data)
}

// ResolveLogoPath resolves a local filesystem path for a logo image.
func ResolveLogoPath(logoURL string) string {
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

func resolveLogoPath(logoURL string) string {
	return ResolveLogoPath(logoURL)
}

// ResolveFontPath resolves the font file path regardless of working directory.
func ResolveFontPath(fontRelPath string) string {
	candidates := []string{
		fontRelPath,
		filepath.Join("backend", fontRelPath),
		filepath.Join("..", fontRelPath),
		filepath.Join("..", "..", fontRelPath),
		filepath.Join("..", "..", "..", fontRelPath),
		filepath.Join("..", "..", "..", "..", fontRelPath),
		filepath.Join("..", "..", "..", "..", "..", fontRelPath),
		filepath.Join("..", "..", "..", "..", "..", "..", fontRelPath),
	}
	for _, c := range candidates {
		if info, err := os.Stat(c); err == nil && !info.IsDir() {
			return c
		}
	}
	return fontRelPath
}

func resolveFontPath(fontRelPath string) string {
	return ResolveFontPath(fontRelPath)
}


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
		result += ConvertThaiNumber(intPart) + "บาท"
	}

	if satangPart == 0 {
		result += "ถ้วน"
	} else {
		if intPart == 0 {
			result += ConvertThaiNumber(satangPart) + "สตางค์"
		} else {
			result += ConvertThaiNumber(satangPart) + "สตางค์"
		}
	}

	return result
}

// ConvertThaiNumber แปลงจำนวนเต็มเป็นคำอ่านภาษาไทย
func ConvertThaiNumber(n int64) string {
	if n == 0 {
		return "ศูนย์"
	}

	if n >= 1000000 {
		millions := n / 1000000
		remainder := n % 1000000
		millionsText := ConvertThaiNumber(millions) + "ล้าน"
		if remainder > 0 {
			if remainder >= 1000000 {
				return millionsText + ConvertThaiNumber(remainder)
			}
			return millionsText + ConvertUnderMillion(remainder)
		}
		return millionsText
	}

	return ConvertUnderMillion(n)
}

func convertThaiNumber(n int64) string {
	return ConvertThaiNumber(n)
}

// ConvertUnderMillion แปลงตัวเลขต่ำกว่าหนึ่งล้านเป็นคำอ่านภาษาไทย
func ConvertUnderMillion(n int64) string {
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

func convertUnderMillion(n int64) string {
	return ConvertUnderMillion(n)
}

// HexToColor แปลง Hex Code (#RRGGBB หรือ RRGGBB) เป็น Maroto color.Color
func HexToColor(hex string) color.Color {
	var r, g, b uint8
	if len(hex) > 0 && hex[0] == '#' {
		hex = hex[1:]
	}
	if len(hex) == 6 {
		fmt.Sscanf(hex, "%02x%02x%02x", &r, &g, &b)
	}
	return color.Color{Red: int(r), Green: int(g), Blue: int(b)}
}

func hexToColor(hex string) color.Color {
	return HexToColor(hex)
}

// FormatThaiDate แปลง time.Time เป็นวันที่ภาษาไทย เช่น 12 ต.ค. 2568
func FormatThaiDate(t time.Time) string {
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

func formatThaiDate(t time.Time) string {
	return FormatThaiDate(t)
}

// GetItemSubDetails รวบรวมข้อมูล แบรนด์, เกรด และรุ่นรถที่รองรับ
func GetItemSubDetails(item entity.SaleOrderItem) string {
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

func getItemSubDetails(item entity.SaleOrderItem) string {
	return GetItemSubDetails(item)
}
