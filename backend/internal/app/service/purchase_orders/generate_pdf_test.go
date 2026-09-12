package purchaseorders

import (
	"context"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/johnfercher/maroto/pkg/consts"
)

func TestLoadPOLogoFromRemoteURL(t *testing.T) {
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

	filePath, gotBase64, extension, err := loadPOLogo(context.Background(), server.URL+"/logo.png")
	if err != nil {
		t.Fatalf("loadPOLogo() error = %v", err)
	}
	if filePath != "" {
		t.Fatalf("loadPOLogo() file path = %q, want empty path for remote image", filePath)
	}
	if gotBase64 != pngBase64 {
		t.Fatalf("loadPOLogo() returned unexpected base64 image")
	}
	if extension != consts.Png {
		t.Fatalf("loadPOLogo() extension = %q, want %q", extension, consts.Png)
	}
}

func TestLoadPOLogoRejectsRemoteHTTPError(t *testing.T) {
	server := httptest.NewServer(http.NotFoundHandler())
	t.Cleanup(server.Close)

	if _, _, _, err := loadPOLogo(context.Background(), server.URL+"/missing.png"); err == nil {
		t.Fatal("loadPOLogo() error = nil, want an HTTP status error")
	}
}

func TestResolvePOLogoPathFromUploadURL(t *testing.T) {
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

	got := resolvePOLogoPath("/uploads/logo.png")
	want := filepath.Join("uploads", "logo.png")
	if got != want {
		t.Fatalf("resolvePOLogoPath() = %q, want %q", got, want)
	}
}

func TestResolvePOLogoPathSkipsMissingLogo(t *testing.T) {
	if got := resolvePOLogoPath("/uploads/missing-logo.png"); got != "" {
		t.Fatalf("resolvePOLogoPath() = %q, want empty path", got)
	}
}
