package storage_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"backend/internal/pkg/storage"
)

func TestUploadCompanyLogoStoresObjectInSupabaseFolder(t *testing.T) {
	const serviceKey = "test-service-key"
	const imageBody = "fake-png-bytes"

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != "/storage/v1/object/G03-Capstone/company-logos/logo_test.png" {
			t.Errorf("path = %s", r.URL.Path)
		}
		if r.Header.Get("Authorization") != "Bearer "+serviceKey {
			t.Error("missing Supabase bearer token")
		}
		if r.Header.Get("apikey") != serviceKey {
			t.Error("missing Supabase apikey header")
		}
		if r.Header.Get("Content-Type") != "image/png" {
			t.Errorf("content type = %s", r.Header.Get("Content-Type"))
		}
		if r.Header.Get("x-upsert") != "true" {
			t.Error("x-upsert header must be true")
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			t.Fatalf("read body: %v", err)
		}
		if string(body) != imageBody {
			t.Errorf("body = %q", string(body))
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_SECRET_KEY", serviceKey)

	got, err := storage.UploadCompanyLogo("logo_test.png", "image/png", []byte(imageBody))
	if err != nil {
		t.Fatalf("UploadCompanyLogo() error = %v", err)
	}
	want := server.URL + "/storage/v1/object/public/G03-Capstone/company-logos/logo_test.png"
	if got != want {
		t.Fatalf("URL = %q, want %q", got, want)
	}
}

func TestUploadCompanyLogoReturnsSupabaseErrorWithoutLocalFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		_, _ = w.Write([]byte(`{"message":"bucket rejected upload"}`))
	}))
	defer server.Close()

	t.Setenv("SUPABASE_URL", server.URL)
	t.Setenv("SUPABASE_SECRET_KEY", "test-service-key")

	url, err := storage.UploadCompanyLogo("logo_test.png", "image/png", []byte("image"))
	if err == nil {
		t.Fatal("expected Supabase error")
	}
	if url != "" {
		t.Fatalf("URL = %q, want empty", url)
	}
	if !strings.Contains(err.Error(), "bucket rejected upload") {
		t.Fatalf("unexpected error: %v", err)
	}
}
