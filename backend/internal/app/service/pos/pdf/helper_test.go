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


