package storage

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

const claimEvidenceBucket = "G03-Capstone"
const productImageBucket = "G03-Capstone"
const companyLogoBucket = "G03-Capstone"

var supabaseHTTPClient = &http.Client{Timeout: 30 * time.Second}

func loadStorageEnv() {
	// Keep explicitly supplied environment variables (for deployments/tests)
	// and only fill missing values from local development files.
	for _, envFile := range []string{".env", "../.env", "backend/.env"} {
		_ = godotenv.Load(envFile)
	}
}

func uploadToSupabase(bucket, objectPath, mimeType string, data []byte) (string, error) {
	loadStorageEnv()

	supabaseURL := strings.TrimRight(os.Getenv("SUPABASE_URL"), "/")
	serviceKey := os.Getenv("SUPABASE_SECRET_KEY")
	if serviceKey == "" {
		serviceKey = os.Getenv("SUPABASE_KEY")
	}
	if serviceKey == "" {
		serviceKey = os.Getenv("api_key")
	}
	if supabaseURL == "" || serviceKey == "" {
		return "", fmt.Errorf("ยังไม่ได้ตั้งค่า SUPABASE_URL หรือ SUPABASE_SECRET_KEY")
	}

	objectPath = strings.TrimLeft(objectPath, "/")
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, objectPath)
	req, err := http.NewRequest(http.MethodPost, uploadURL, bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("สร้างคำขออัปโหลด Supabase ไม่สำเร็จ: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+serviceKey)
	req.Header.Set("apikey", serviceKey)
	req.Header.Set("Content-Type", mimeType)
	req.Header.Set("x-upsert", "true")

	resp, err := supabaseHTTPClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("เชื่อมต่อ Supabase Storage ไม่สำเร็จ: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= http.StatusBadRequest {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		detail := strings.TrimSpace(string(body))
		if detail == "" {
			detail = resp.Status
		}
		return "", fmt.Errorf("Supabase Storage ปฏิเสธการอัปโหลด (%d): %s", resp.StatusCode, detail)
	}

	publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, objectPath)
	return publicURL, nil
}

// UploadToSupabase uploads raw bytes to a Supabase Storage bucket and returns the public URL.
func UploadToSupabase(bucket, filename, mimeType string, data []byte) (string, error) {
	if publicURL, err := uploadToSupabase(bucket, filename, mimeType, data); err == nil {
		return publicURL, nil
	}

	// Fallback to local storage in ./uploads
	if err := os.MkdirAll("./uploads", 0755); err != nil {
		return "", fmt.Errorf("สร้างโฟลเดอร์ uploads ไม่ได้: %w", err)
	}
	filePath := "./uploads/" + filename
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return "", fmt.Errorf("สร้างโฟลเดอร์ปลายทางไม่ได้: %w", err)
	}
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return "", fmt.Errorf("บันทึกไฟล์ภาพไม่สำเร็จ: %w", err)
	}
	return "/uploads/" + filename, nil
}

// UploadClaimEvidence is a convenience wrapper for the claim-evidence bucket.
func UploadClaimEvidence(filename, mimeType string, data []byte) (string, error) {
	return UploadToSupabase(claimEvidenceBucket, filename, mimeType, data)
}

// UploadProductImage stores WMS product images under the shared Supabase bucket.
func UploadProductImage(filename, mimeType string, data []byte) (string, error) {
	return UploadToSupabase(productImageBucket, filename, mimeType, data)
}

// UploadCompanyLogo stores company logo images under the shared Supabase bucket.
func UploadCompanyLogo(filename, mimeType string, data []byte) (string, error) {
	return uploadToSupabase(companyLogoBucket, "company-logos/"+filename, mimeType, data)
}
