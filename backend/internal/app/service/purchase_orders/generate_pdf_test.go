package purchaseorders

import (
	"os"
	"path/filepath"
	"testing"
)

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
