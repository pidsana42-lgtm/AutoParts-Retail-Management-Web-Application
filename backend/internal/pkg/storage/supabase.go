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

const defaultCustomerDocumentBucket = "G03-Capstone"

func getCustomerDocumentBucket() string {
	b := strings.TrimSpace(os.Getenv("CUSTOMER_DOCUMENT_BUCKET"))
	if b != "" {
		return b
	}
	return defaultCustomerDocumentBucket
}

// UploadCustomerDocument stores customer ID card / registration documents securely.
// ปิดสิทธิ์ Public: ไม่เปิดเผย Public URL และไม่บันทึกลงโฟลเดอร์ public
// คืนค่าเป็น relative storage path เช่น "customer_documents/customer_doc_123.jpg"
func UploadCustomerDocument(filename, mimeType string, data []byte) (string, error) {
	_ = godotenv.Overload(".env", "../.env", "backend/.env")

	bucket := getCustomerDocumentBucket()
	storagePath := "customer_documents/" + filename

	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SECRET_KEY"))
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_KEY"))
	}
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("api_key"))
	}

	if supabaseURL != "" && serviceKey != "" {
		uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, storagePath)

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
					// ปิดสิทธิ์ Public: ไม่คืนค่า public URL แต่คืนค่า storagePath ภายใน
					return storagePath, nil
				}
			}
		}
	}

	// Fallback to local private storage (อยู่นอก ./uploads เพื่อป้องกันการเข้าถึงแบบ Public ผ่าน r.Static)
	privateBaseDir := "./private_storage/customer_documents"
	if err := os.MkdirAll(privateBaseDir, 0700); err != nil {
		return "", fmt.Errorf("สร้างโฟลเดอร์ private storage ไม่ได้: %w", err)
	}
	filePath := filepath.Join(privateBaseDir, filename)
	if err := os.WriteFile(filePath, data, 0600); err != nil {
		return "", fmt.Errorf("บันทึกไฟล์เอกสารไม่สำเร็จ: %w", err)
	}
	return storagePath, nil
}

// GetCustomerDocument ดึงไฟล์เอกสารบัตรประชาชนผ่าน Backend เท่านั้น โดยใช้ Service Key หรืออ่านจาก Private Storage
func GetCustomerDocument(storagePath string) ([]byte, string, error) {
	_ = godotenv.Overload(".env", "../.env", "backend/.env")

	if storagePath == "" {
		return nil, "", fmt.Errorf("พาธเอกสารว่างเปล่า")
	}

	bucket := getCustomerDocumentBucket()
	supabaseURL := strings.TrimSpace(os.Getenv("SUPABASE_URL"))
	serviceKey := strings.TrimSpace(os.Getenv("SUPABASE_SECRET_KEY"))
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("SUPABASE_KEY"))
	}
	if serviceKey == "" {
		serviceKey = strings.TrimSpace(os.Getenv("api_key"))
	}

	// แยกชื่อไฟล์และ subpath เผื่อกรณีเก็บแบบ URL เดิม (Backward compatible)
	cleanPath := storagePath
	if strings.Contains(cleanPath, "/storage/v1/object/public/"+bucket+"/") {
		cleanPath = strings.SplitN(cleanPath, "/storage/v1/object/public/"+bucket+"/", 2)[1]
	} else if strings.Contains(cleanPath, "/storage/v1/object/authenticated/"+bucket+"/") {
		cleanPath = strings.SplitN(cleanPath, "/storage/v1/object/authenticated/"+bucket+"/", 2)[1]
	} else if strings.HasPrefix(cleanPath, "/uploads/") {
		cleanPath = strings.TrimPrefix(cleanPath, "/uploads/")
	} else if strings.HasPrefix(cleanPath, "uploads/") {
		cleanPath = strings.TrimPrefix(cleanPath, "uploads/")
	}
	cleanPath = strings.TrimPrefix(cleanPath, "/")

	// 1. ดึงจาก Supabase Storage ถ้ามีการกำหนด URL และ Service Key
	if supabaseURL != "" && serviceKey != "" {
		downloadEndpoints := []string{
			fmt.Sprintf("%s/storage/v1/object/authenticated/%s/%s", supabaseURL, bucket, cleanPath),
			fmt.Sprintf("%s/storage/v1/object/%s/%s", supabaseURL, bucket, cleanPath),
		}

		for _, dlURL := range downloadEndpoints {
			req, err := http.NewRequest(http.MethodGet, dlURL, nil)
			if err != nil {
				continue
			}
			req.Header.Set("Authorization", "Bearer "+serviceKey)
			req.Header.Set("apikey", serviceKey)

			resp, err := http.DefaultClient.Do(req)
			if err == nil {
				if resp.StatusCode == http.StatusOK {
					defer resp.Body.Close()
					data, err := io.ReadAll(resp.Body)
					if err == nil && len(data) > 0 {
						contentType := resp.Header.Get("Content-Type")
						if contentType == "" || contentType == "application/octet-stream" {
							contentType = detectMimeType(cleanPath, data)
						}
						return data, contentType, nil
					}
				} else {
					resp.Body.Close()
				}
			}
		}
	}

	// 2. ดึงจาก Local Private Storage หรือ Local Uploads (Fallback & Backward compatibility)
	possiblePaths := []string{
		filepath.Join("./private_storage", cleanPath),
		filepath.Join("./private_storage/customer_documents", filepath.Base(cleanPath)),
		filepath.Join("./uploads", cleanPath),
		filepath.Join("./uploads/customer_documents", filepath.Base(cleanPath)),
		filepath.Join("./uploads", filepath.Base(cleanPath)),
	}

	for _, p := range possiblePaths {
		if data, err := os.ReadFile(p); err == nil {
			contentType := detectMimeType(p, data)
			return data, contentType, nil
		}
	}

	return nil, "", fmt.Errorf("ไม่พบไฟล์เอกสารในระบบ")
}

func detectMimeType(filename string, data []byte) string {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".pdf":
		return "application/pdf"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".webp":
		return "image/webp"
	case ".gif":
		return "image/gif"
	}
	detected := http.DetectContentType(data)
	if detected != "" && detected != "application/octet-stream" {
		return detected
	}
	return "application/octet-stream"
}
