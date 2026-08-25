package storage

import (
	"bytes"
	"fmt"
	"net/http"
	"os"
	"path/filepath"

	"github.com/joho/godotenv"
)

const claimEvidenceBucket = "G03-Capstone"
const productImageBucket = "G03-Capstone"
const companyLogoBucket = "G03-Capstone"

// UploadToSupabase uploads raw bytes to a Supabase Storage bucket and returns the public URL.
func UploadToSupabase(bucket, filename, mimeType string, data []byte) (string, error) {
	_ = godotenv.Overload(".env", "../.env", "backend/.env")

	supabaseURL := os.Getenv("SUPABASE_URL")
	serviceKey := os.Getenv("SUPABASE_SECRET_KEY")
	if serviceKey == "" {
		serviceKey = os.Getenv("SUPABASE_KEY")
	}
	if serviceKey == "" {
		serviceKey = os.Getenv("api_key")
	}

	if supabaseURL != "" && serviceKey != "" {
		uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, filename)

		req, err := http.NewRequest(http.MethodPost, uploadURL, bytes.NewReader(data))
		if err == nil {
			req.Header.Set("Authorization", "Bearer "+serviceKey)
			req.Header.Set("apikey", serviceKey)
			req.Header.Set("Content-Type", mimeType)
			req.Header.Set("x-upsert", "true")

			resp, err := http.DefaultClient.Do(req)
			if err == nil {
				defer resp.Body.Close()
				if resp.StatusCode < 400 {
					publicURL := fmt.Sprintf("%s/storage/v1/object/public/%s/%s", supabaseURL, bucket, filename)
					return publicURL, nil
				}
			}
		}
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
	return UploadToSupabase(companyLogoBucket, filename, mimeType, data)
}

