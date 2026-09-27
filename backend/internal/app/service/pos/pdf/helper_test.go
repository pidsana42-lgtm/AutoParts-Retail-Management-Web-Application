package pdf

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"backend/internal/app/entity"

	"github.com/johnfercher/maroto/pkg/consts"
	marotoPdf "github.com/johnfercher/maroto/pkg/pdf"
)

func TestThaiBahtText(t *testing.T) {
	tests := []struct {
		amount float64
		want   string
	}{
		{0.00, "ศูนย์บาทถ้วน"},
		{1.00, "หนึ่งบาทถ้วน"},
		{11.00, "สิบเอ็ดบาทถ้วน"},
		{21.00, "ยี่สิบเอ็ดบาทถ้วน"},
		{101.00, "หนึ่งร้อยเอ็ดบาทถ้วน"},
		{1001.00, "หนึ่งพันเอ็ดบาทถ้วน"},
		{1653.00, "หนึ่งพันหกร้อยห้าสิบสามบาทถ้วน"},
		{1653.50, "หนึ่งพันหกร้อยห้าสิบสามบาทห้าสิบสตางค์"},
		{25.25, "ยี่สิบห้าบาทยี่สิบห้าสตางค์"},
		{1000000.00, "หนึ่งล้านบาทถ้วน"},
		{1000001.00, "หนึ่งล้านหนึ่งบาทถ้วน"},
		{1234567.89, "หนึ่งล้านสองแสนสามหมื่นสี่พันห้าร้อยหกสิบเจ็ดบาทแปดสิบเก้าสตางค์"},
	}

	for _, tt := range tests {
		got := ThaiBahtText(tt.amount)
		if got != tt.want {
			t.Errorf("ThaiBahtText(%v) = %q, want %q", tt.amount, got, tt.want)
		}
	}
}

func TestFormatThaiDate(t *testing.T) {
	d := time.Date(2025, 10, 12, 0, 0, 0, 0, time.UTC)
	got := FormatThaiDate(d)
	want := "12 ต.ค. 2568"
	if got != want {
		t.Errorf("FormatThaiDate() = %q, want %q", got, want)
	}
}

func TestHexToColor(t *testing.T) {
	c := HexToColor("#E51C23")
	if c.Red != 229 || c.Green != 28 || c.Blue != 35 {
		t.Errorf("HexToColor(#E51C23) = {%d, %d, %d}, want {229, 28, 35}", c.Red, c.Green, c.Blue)
	}
}

func TestLoadLogoEmpty(t *testing.T) {
	filePath, base64Data, _, err := LoadLogo(context.Background(), "")
	if err != nil {
		t.Fatalf("LoadLogo(\"\") error = %v, want nil", err)
	}
	if filePath != "" || base64Data != "" {
		t.Fatalf("LoadLogo(\"\") returned filePath=%q, base64Data=%q, want empty", filePath, base64Data)
	}
}

func TestLoadLogoFromRemoteURL(t *testing.T) {
	const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
	pngData, err := base64.StdEncoding.DecodeString(pngBase64)
	if err != nil {
		t.Fatalf("decode test PNG: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(pngData)
	}))
	t.Cleanup(server.Close)

	filePath, gotBase64, extension, err := LoadLogo(context.Background(), server.URL+"/logo.png")
	if err != nil {
		t.Fatalf("LoadLogo() error = %v", err)
	}
	if filePath != "" {
		t.Fatalf("LoadLogo() file path = %q, want empty path for remote image", filePath)
	}
	if gotBase64 != pngBase64 {
		t.Fatalf("LoadLogo() returned unexpected base64 image")
	}
	if extension != consts.Png {
		t.Fatalf("LoadLogo() extension = %q, want %q", extension, consts.Png)
	}
}

func TestLoadLogoRejectsRemoteHTTPError(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	t.Cleanup(server.Close)

	if _, _, _, err := LoadLogo(context.Background(), server.URL+"/missing.png"); err == nil {
		t.Fatal("LoadLogo() error = nil, want an HTTP status error")
	}
}

func TestResolveLogoPathFromUploadURL(t *testing.T) {
	tempDir := t.TempDir()
	uploadDir := filepath.Join(tempDir, "uploads")
	if err := os.Mkdir(uploadDir, 0o755); err != nil {
		t.Fatalf("create uploads directory: %v", err)
	}

	logoPath := filepath.Join(uploadDir, "logo.png")
	if err := os.WriteFile(logoPath, []byte("test"), 0o644); err != nil {
		t.Fatalf("create logo: %v", err)
	}

	originalWorkingDir, err := os.Getwd()
	if err != nil {
		t.Fatalf("get working directory: %v", err)
	}
	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("change working directory: %v", err)
	}
	t.Cleanup(func() {
		if err := os.Chdir(originalWorkingDir); err != nil {
			t.Errorf("restore working directory: %v", err)
		}
	})

	got := ResolveLogoPath("/uploads/logo.png")
	want := filepath.Join("uploads", "logo.png")
	if got != want {
		t.Fatalf("ResolveLogoPath() = %q, want %q", got, want)
	}
}

func TestResolveLogoPathSkipsMissingLogo(t *testing.T) {
	if got := ResolveLogoPath("/uploads/missing-logo.png"); got != "" {
		t.Fatalf("ResolveLogoPath() = %q, want empty path", got)
	}
}

func TestGenerateSaleOrderPDFWithLogo(t *testing.T) {
	const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
	pngData, err := base64.StdEncoding.DecodeString(pngBase64)
	if err != nil {
		t.Fatalf("decode test PNG: %v", err)
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "image/png")
		_, _ = w.Write(pngData)
	}))
	t.Cleanup(server.Close)

	paymentMethodID := uint(1)
	order := &entity.SaleOrder{
		OrderNumber:     "SO-TEST-001",
		PaymentMethodID: &paymentMethodID,
		Status:          "completed",
		Items: []entity.SaleOrderItem{
			{
				ProductID:   1,
				Qty:         2,
				UnitPrice:   100,
				ProductName: "Test Product",
			},
		},
		TotalAmount: 200,
	}
	order.CreatedAt = time.Now()

	companySetting := &entity.CompanySetting{
		CompanyName: "Test Company",
		LogoURL:     server.URL + "/logo.png",
	}

	pdfBytes, err := GenerateSaleOrderPDF(order, companySetting, "ใบเสร็จรับเงิน")
	if err != nil {
		t.Fatalf("GenerateSaleOrderPDF error: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatalf("GenerateSaleOrderPDF returned empty bytes")
	}
}

func TestGenerateDebtRepaymentReceiptPDFWithBarcode(t *testing.T) {
	repayment := entity.PaymentRepayment{
		ReceiptNumber: "RCP-TEST-001",
		AmountPaid:    500,
	}
	repayment.CreatedAt = time.Now()
	repayment.Order.OrderNumber = "SO-TEST-001"
	repayment.Order.Customer.CustomerName = "ลูกค้าทดสอบ"
	repayments := []entity.PaymentRepayment{repayment}

	companySetting := &entity.CompanySetting{
		CompanyName: "Test Company",
	}

	pdfBytes, err := GenerateDebtRepaymentReceiptPDF(repayments, companySetting, func(orderID, repaymentID uint) (float64, error) {
		return 0, nil
	})
	if err != nil {
		t.Fatalf("GenerateDebtRepaymentReceiptPDF error: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatalf("GenerateDebtRepaymentReceiptPDF returned empty bytes")
	}
}

func TestGenerateDebtRepaymentReceiptPDF_MultipleBillsWithPartialPayment(t *testing.T) {
	now := time.Now()
	commonReceiptNo := "RE-2026-001-99999"

	rep1 := entity.PaymentRepayment{
		ReceiptNumber: commonReceiptNo,
		OrderID:       101,
		AmountPaid:    400.0,
		Status:        "completed",
	}
	rep1.ID = 1
	rep1.CreatedAt = now
	rep1.Order.ID = 101
	rep1.Order.OrderNumber = "INV-2026-001"
	rep1.Order.TotalAmount = 1000.0
	rep1.Order.Customer.CustomerName = "สมชาย ขายดี"

	rep2 := entity.PaymentRepayment{
		ReceiptNumber: commonReceiptNo,
		OrderID:       102,
		AmountPaid:    2500.0,
		Status:        "completed",
	}
	rep2.ID = 2
	rep2.CreatedAt = now
	rep2.Order.ID = 102
	rep2.Order.OrderNumber = "INV-2026-002"
	rep2.Order.TotalAmount = 2500.0
	rep2.Order.Customer.CustomerName = "สมชาย ขายดี"

	repayments := []entity.PaymentRepayment{rep1, rep2}

	companySetting := &entity.CompanySetting{
		CompanyName:   "เจ.เจ อะไหล่",
		Address:       "หนองสาหร่าย ปากช่อง",
		PhoneNumber:   "096-7985115",
		BankName:      "กสิกรไทย",
		BankAccountNumber: "123-4-56789-0",
		BankAccountName:   "เจ.เจ อะไหล่",
	}

	pdfBytes, err := GenerateDebtRepaymentReceiptPDF(repayments, companySetting, func(orderID, repaymentID uint) (float64, error) {
		return 0, nil
	})
	if err != nil {
		t.Fatalf("GenerateDebtRepaymentReceiptPDF failed with multiple bills: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatalf("GenerateDebtRepaymentReceiptPDF returned empty bytes for multiple bills")
	}
}

func TestGenerateSaleOrderPDFWithLongProductName(t *testing.T) {
	paymentMethodID := uint(1)
	order := &entity.SaleOrder{
		OrderNumber:     "SO-TEST-LONG-001",
		PaymentMethodID: &paymentMethodID,
		Status:          "completed",
		Items: []entity.SaleOrderItem{
			{
				ProductID:   1,
				Qty:         1,
				UnitPrice:   56.25,
				ProductName: "ตัวยูโซ่คูโบต้า+สลัก+ปริ้น DTแท้ สีทอง สลัก12MM KUBOTA, L3408,L3608,L4508,L4708",
				Product: entity.Product{
					Product_Code: "COLRAD-00003",
					Grade: &entity.Grade{
						Grade_Name: "OEM",
					},
					Models: []entity.Models{
						{
							Model_Name: "HILUX REVO 2.8",
						},
					},
				},
			},
		},
		TotalAmount: 56.25,
	}
	order.CreatedAt = time.Now()

	companySetting := &entity.CompanySetting{
		CompanyName: "Test Company",
	}

	pdfBytes, err := GenerateSaleOrderPDF(order, companySetting, "ใบเสร็จรับเงิน")
	if err != nil {
		t.Fatalf("GenerateSaleOrderPDF error with long product name: %v", err)
	}
	if len(pdfBytes) == 0 {
		t.Fatalf("GenerateSaleOrderPDF returned empty bytes for long product name")
	}
}

func TestDebugSaleOrderLayout(t *testing.T) {
	m := marotoPdf.NewMaroto(consts.Portrait, consts.A4)
	m.SetPageMargins(10, 15, 10)
	m.AddUTF8Font("THSarabun", consts.Normal, ResolveFontPath("assets/fonts/THSarabunNew.ttf"))
	m.AddUTF8Font("THSarabun", consts.Bold, ResolveFontPath("assets/fonts/THSarabunNew Bold.ttf"))
	m.SetDefaultFontFamily("THSarabun")

	// Case 1: ข้อความยาวแบบมีวรรคและคำยาวตาม Screenshot ของผู้ใช้
	prod1 := "Synthetic Motor Oil 5L เทสชื่อยาวมากๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆ เพื่อเช็คสปิเต้"
	specs1 := "รุ่นรถ: REVO 2.8"
	rowH1, specsT1 := calcSaleOrderItemLayout(m, prod1, specs1)
	t.Logf("Case 1 (Screenshot): rowHeight=%.2f, specsTop=%.2f", rowH1, specsT1)
	if specsT1 <= 4.5 {
		t.Fatalf("specsTop (%.2f) must be > 4.5 to avoid overlapping line 2", specsT1)
	}

	// Case 2: ข้อความภาษาไทยยาวต่อเนื่องไม่มีวรรค
	prod2 := "ตัวยูโซ่คูโบต้า+สลัก+ปริ้นDTแท้สีทองสลัก12MMKUBOTA,L3408,L3608,L4508,L4708ยาวมากๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆๆ"
	specs2 := "รุ่นรถ: REVO 2.8"
	rowH2, specsT2 := calcSaleOrderItemLayout(m, prod2, specs2)
	t.Logf("Case 2 (Continuous): rowHeight=%.2f, specsTop=%.2f", rowH2, specsT2)
	if specsT2 <= 4.5 {
		t.Fatalf("specsTop (%.2f) must be > 4.5 to avoid overlapping line 2", specsT2)
	}
}



