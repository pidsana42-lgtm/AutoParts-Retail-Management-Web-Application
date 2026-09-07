package customer

import (
	"fmt"
	"io"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	customerDto "backend/internal/app/dto/customer"
	customerSvc "backend/internal/app/service/customer"
	"backend/internal/pkg/storage"

	"github.com/gin-gonic/gin"
)

var allowedCustomerDocMIME = map[string]bool{
	"image/jpeg":      true,
	"image/png":       true,
	"image/webp":      true,
	"image/gif":       true,
	"application/pdf": true,
}

type CustomerController struct {
	svc customerSvc.CustomerService
}

func NewCustomerController(svc customerSvc.CustomerService) *CustomerController {
	return &CustomerController{svc: svc}
}

func handleCustomerFileUpload(c *gin.Context) (string, error) {
	fileHeader, err := c.FormFile("file")
	if err != nil {
		fileHeader, err = c.FormFile("image")
	}
	if err != nil {
		return "", nil // ไม่มีไฟล์แนบมา
	}

	if fileHeader.Size > 10*1024*1024 {
		return "", fmt.Errorf("ขนาดไฟล์เกิน 10MB")
	}

	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("เปิดไฟล์ไม่สำเร็จ")
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("อ่านไฟล์ไม่สำเร็จ")
	}

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" || mimeType == "application/octet-stream" {
		mimeType = http.DetectContentType(data)
	}

	if !allowedCustomerDocMIME[mimeType] {
		return "", fmt.Errorf("รองรับเฉพาะไฟล์ภาพ (JPEG, PNG, WEBP, GIF) หรือเอกสาร PDF")
	}

	ext := strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		if mimeType == "application/pdf" {
			ext = ".pdf"
		} else {
			ext = ".jpg"
		}
	}
	filename := fmt.Sprintf("customer_doc_%d%s", time.Now().UnixNano(), ext)

	publicURL, err := storage.UploadCustomerDocument(filename, mimeType, data)
	if err != nil {
		return "", fmt.Errorf("อัปโหลดเอกสารไม่สำเร็จ: %w", err)
	}

	return publicURL, nil
}

func (ctrl *CustomerController) RegisterCustomer(c *gin.Context) {
	var req customerDto.RegisterCustomerRequest

	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	// ถ้ามีการแนบไฟล์ใน request เดียวกัน (multipart/form-data) ให้อัปโหลดเข้า Supabase ทันที
	uploadedURL, err := handleCustomerFileUpload(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	idCardImagePath := req.IdCardImagePath
	if uploadedURL != "" {
		idCardImagePath = uploadedURL
	}

	if err := ctrl.svc.RegisterNewCustomer(req, idCardImagePath); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":            "ลงทะเบียนสมาชิกใหม่สำเร็จเรียบร้อยแล้ว",
		"id_card_image_path": idCardImagePath,
	})
}

func (ctrl *CustomerController) UpdateCustomer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ ID ลูกค้าไม่ถูกต้อง"})
		return
	}

	var req customerDto.UpdateCustomerRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	// ถ้ามีการแนบไฟล์ใหม่ใน request เดียวกัน ให้อัปโหลดเข้า Supabase ทันที
	uploadedURL, err := handleCustomerFileUpload(c)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if uploadedURL != "" {
		req.IdCardImagePath = uploadedURL
	}

	userID := getUserIDFromContext(c)
	if err := ctrl.svc.UpdateCustomer(uint(id), req, userID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":            "แก้ไขข้อมูลลูกค้าสำเร็จ",
		"id_card_image_path": req.IdCardImagePath,
	})
}


func (ctrl *CustomerController) GetAllCustomers(c *gin.Context) {
	customers, err := ctrl.svc.GetAllCustomers()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, customers)
}

func (ctrl *CustomerController) GetCustomerByID(c *gin.Context) {
    idStr := c.Param("id")
    
    id, err := strconv.ParseUint(idStr, 10, 64)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ ID ลูกค้าไม่ถูกต้อง"})
        return
    }

    customer, err := ctrl.svc.GetCustomerByID(uint(id))
    if err != nil {
        c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลสมาชิกคนนี้ในระบบ: " + err.Error()})
        return
    }

    c.JSON(http.StatusOK, customer)
}

func getUserIDFromContext(c *gin.Context) uint {
	if val, exists := c.Get("user_id"); exists {
		switch v := val.(type) {
		case float64:
			return uint(v)
		case uint:
			return v
		case int:
			return uint(v)
		case int64:
			return uint(v)
		}
	}
	return 0
}

func (ctrl *CustomerController) UpdateCustomerDiscount(c *gin.Context) {
	//ดึง id ของลูกค้าที่ต้องการแก้ไขจาก URL
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ ID ลูกค้าไม่ถูกต้อง"})
		return
	}

	var req customerDto.UpdateCustomerDiscountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบข้อมูล JSON ไม่ถูกต้อง: " + err.Error()})
		return
	}

	userID := getUserIDFromContext(c)
	if err := ctrl.svc.UpdateCustomerDiscount(uint(id), req, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถอัปเดตข้อมูลส่วนลดลูกค้าได้: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "อัปเดตข้อมูลส่วนลดลูกค้าสำเร็จ"})
}

func (ctrl *CustomerController) GetCreditAuditLogs(c *gin.Context) {
	logs, err := ctrl.svc.GetCreditAuditLogs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, logs)
}

func (ctrl *CustomerController) CreateCreditAuditLog(c *gin.Context) {
	var req customerDto.CreateCustomerCreditAuditLogRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "ข้อมูลไม่ถูกต้อง: " + err.Error()})
		return
	}

	userID := getUserIDFromContext(c)
	if err := ctrl.svc.CreateCreditAuditLog(req, userID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"message": "บันทึกประวัติการแก้ไขสำเร็จ"})
}

// GetCustomerDocument เป็น Protected Route สำหรับเข้าถึงเอกสารบัตรประชาชนของลูกค้าตาม ID
func (ctrl *CustomerController) GetCustomerDocument(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบ ID ลูกค้าไม่ถูกต้อง"})
		return
	}

	customer, err := ctrl.svc.GetCustomerByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลลูกค้า"})
		return
	}

	if customer.IdCardImagePath == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "ลูกค้ารายนี้ไม่มีเอกสารประจำตัวแนบไว้ในระบบ"})
		return
	}

	fileBytes, mimeType, err := storage.GetCustomerDocument(customer.IdCardImagePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่สามารถดึงไฟล์เอกสารได้: " + err.Error()})
		return
	}

	filename := filepath.Base(customer.IdCardImagePath)
	if filename == "" || filename == "." || filename == "/" {
		filename = fmt.Sprintf("customer_doc_%d", customer.ID)
	}

	// Security Headers ป้องกันไม่ให้แชร์ / แคชใน Proxy สาธารณะ
	c.Header("Content-Type", mimeType)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Header("Cache-Control", "private, no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("X-Content-Type-Options", "nosniff")

	c.Data(http.StatusOK, mimeType, fileBytes)
}

// GetCustomerDocumentByPath เป็น Protected Route สำหรับเข้าถึงเอกสารลูกค้าผ่าน Relative Storage Path
func (ctrl *CustomerController) GetCustomerDocumentByPath(c *gin.Context) {
	storagePath := c.Query("path")
	if storagePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาระบุพาธของเอกสาร"})
		return
	}

	fileBytes, mimeType, err := storage.GetCustomerDocument(storagePath)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ไม่สามารถดึงไฟล์เอกสารได้: " + err.Error()})
		return
	}

	filename := filepath.Base(storagePath)
	c.Header("Content-Type", mimeType)
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"%s\"", filename))
	c.Header("Cache-Control", "private, no-cache, no-store, must-revalidate")
	c.Header("Pragma", "no-cache")
	c.Header("Expires", "0")
	c.Header("X-Content-Type-Options", "nosniff")

	c.Data(http.StatusOK, mimeType, fileBytes)
}
