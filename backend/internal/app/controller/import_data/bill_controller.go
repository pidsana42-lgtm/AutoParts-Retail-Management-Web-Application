package import_data

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	importDataDTO "backend/internal/app/dto/import_data"
	importDataSvc "backend/internal/app/service/import_data"
	"backend/internal/app/enum"
	"backend/internal/pkg/storage"
	"github.com/gin-gonic/gin"
)

var validSession = regexp.MustCompile(`^[a-zA-Z0-9_-]{6,64}$`)

type BillController struct {
	svc importDataSvc.ImportBillService
}

func NewBillController(svc importDataSvc.ImportBillService) *BillController {
	return &BillController{svc: svc}
}

func (ctrl *BillController) CreateBill(c *gin.Context) {
	var input importDataDTO.CreateBillDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBill(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *BillController) ListBills(c *gin.Context) {
	res, err := ctrl.svc.ListBills()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *BillController) UpdateBill(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input importDataDTO.ConfirmBillImportDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	// การอนุมัติบิล (payment_status=approved / is_verified=true) ทำได้เฉพาะเจ้าของเท่านั้น
	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)
	if roleStr != string(enum.RoleOwner) {
		if input.Bill.PaymentStatus == "approved" || input.Bill.IsVerified {
			c.JSON(http.StatusForbidden, gin.H{"error": "เฉพาะเจ้าของร้านเท่านั้นที่อนุมัติบิลได้"})
			return
		}
	}

	res, err := ctrl.svc.UpdateBill(uint(id), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update bill: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Updated successfully",
		"data":    res,
	})
}

func (ctrl *BillController) DeleteBill(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)

	err = ctrl.svc.DeleteBill(uint(id), roleStr)
	if err != nil {
		if errors.Is(err, importDataSvc.ErrBillDeleteForbidden) {
			c.JSON(http.StatusForbidden, gin.H{"error": "พนักงานลบได้เฉพาะบิลที่ยังไม่อนุมัติเท่านั้น"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete bill: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Deleted successfully",
	})
}

func (ctrl *BillController) CreateBillImage(c *gin.Context) {
	var input importDataDTO.CreateBillImageDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBillImage(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill image: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *BillController) CreateBillImportJob(c *gin.Context) {
	var input importDataDTO.CreateBillImportJobDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBillImportJob(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill import job: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully, OCR processing started",
		"data":    res,
	})
}

func (ctrl *BillController) GetBillImportJob(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.GetBillImportJob(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill import job not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *BillController) ConfirmBillImport(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	var input importDataDTO.ConfirmBillImportDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	roleVal, _ := c.Get("role")
	roleStr, _ := roleVal.(string)

	res, err := ctrl.svc.ConfirmBillImport(uint(id), input, roleStr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm bill import: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Confirmed successfully",
		"data":    res,
	})
}

func (ctrl *BillController) CreateBillItem(c *gin.Context) {
	var input importDataDTO.CreateBillItemDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	res, err := ctrl.svc.CreateBillItem(input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill item: " + err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully",
		"data":    res,
	})
}

func (ctrl *BillController) ListPurchaseOrders(c *gin.Context) {
	res, err := ctrl.svc.ListPurchaseOrders()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": res})
}

func (ctrl *BillController) GetPurchaseOrderById(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID format"})
		return
	}

	res, err := ctrl.svc.GetPurchaseOrderByID(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Purchase Order not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": res})
}

// UploadMobileImage - no auth, session token acts as access control
func (ctrl *BillController) UploadMobileImage(c *gin.Context) {
	session := c.Query("session")
	if !validSession.MatchString(session) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session"})
		return
	}

	fileHeader, err := c.FormFile("image")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no image file provided"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open image file"})
		return
	}
	defer file.Close()

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read image file"})
		return
	}

	safeName := regexp.MustCompile(`[^a-zA-Z0-9._-]`).ReplaceAllString(fileHeader.Filename, "_")
	rawFilename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeName)
	storageFilename := fmt.Sprintf("mobile-tmp/%s/%s", session, rawFilename)

	mimeType := fileHeader.Header.Get("Content-Type")
	if mimeType == "" {
		mimeType = "image/jpeg"
	}

	publicURL, errUpload := storage.UploadToSupabase("G03-Capstone", storageFilename, mimeType, fileBytes)
	if errUpload != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to upload image: " + errUpload.Error()})
		return
	}

	dir := filepath.Join("uploads", "mobile-tmp", session)
	_ = os.MkdirAll(dir, 0755)

	// Save local backup file copy
	localFilePath := filepath.Join(dir, rawFilename)
	_ = os.WriteFile(localFilePath, fileBytes, 0644)

	urlListPath := filepath.Join(dir, "urls.txt")
	f, errOpen := os.OpenFile(urlListPath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if errOpen == nil {
		_, _ = f.WriteString(publicURL + "\n")
		f.Close()
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "uploaded",
		"url":     publicURL,
	})
}

// GetMobileImages - returns list of image URLs uploaded for a session
func (ctrl *BillController) GetMobileImages(c *gin.Context) {
	session := c.Query("session")
	if !validSession.MatchString(session) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session"})
		return
	}

	dir := filepath.Join("uploads", "mobile-tmp", session)
	urlListPath := filepath.Join(dir, "urls.txt")

	var urls []string
	if b, err := os.ReadFile(urlListPath); err == nil {
		lines := strings.Split(string(b), "\n")
		for _, line := range lines {
			trimmed := strings.TrimSpace(line)
			if trimmed != "" {
				urls = append(urls, trimmed)
			}
		}
	}

	if len(urls) == 0 {
		entries, errDir := os.ReadDir(dir)
		if errDir == nil {
			for _, entry := range entries {
				if !entry.IsDir() && entry.Name() != "urls.txt" {
					urls = append(urls, fmt.Sprintf("/uploads/mobile-tmp/%s/%s", session, entry.Name()))
				}
			}
		}
	}

	if urls == nil {
		urls = []string{}
	}

	c.JSON(http.StatusOK, gin.H{"images": urls})
}

// ClearMobileImages - deletes all images for a session (called when desktop is done)
func (ctrl *BillController) ClearMobileImages(c *gin.Context) {
	session := c.Query("session")
	if !validSession.MatchString(session) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid session"})
		return
	}

	os.RemoveAll(filepath.Join("uploads", "mobile-tmp", session))
	c.JSON(http.StatusOK, gin.H{"message": "cleared"})
}

func (ctrl *BillController) UpdateProduct(c *gin.Context) {
	idParam := c.Param("id")
	id, err := strconv.ParseUint(idParam, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product ID"})
		return
	}

	var input importDataDTO.UpdateImportProductDTO
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid product data: " + err.Error()})
		return
	}

	if err := ctrl.svc.UpdateProduct(uint(id), input); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update product: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Product updated successfully",
		"status":  "success",
	})
}
