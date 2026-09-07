package pdf

import (
	"fmt"
	"math"
	"strings"
	"time"

	"backend/internal/app/entity"

	"github.com/johnfercher/maroto/pkg/color"
)

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
