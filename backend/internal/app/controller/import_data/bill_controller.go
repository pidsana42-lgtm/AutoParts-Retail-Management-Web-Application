package import_data

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"time"

	importDataDTO "backend/internal/app/dto/import_data"
	importDataSvc "backend/internal/app/service/import_data"
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

	err = ctrl.svc.DeleteBill(uint(id))
	if err != nil {
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

	res, err := ctrl.svc.ConfirmBillImport(uint(id), input)
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

	dir := filepath.Join("uploads", "mobile-tmp", session)
	if err := os.MkdirAll(dir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create directory"})
		return
	}

	// Sanitize filename and prefix with nanosecond timestamp for unique ordering
	safeName := regexp.MustCompile(`[^a-zA-Z0-9._-]`).ReplaceAllString(fileHeader.Filename, "_")
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), safeName)

	if err := c.SaveUploadedFile(fileHeader, filepath.Join(dir, filename)); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save file"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "uploaded",
		"url":     fmt.Sprintf("/uploads/mobile-tmp/%s/%s", session, filename),
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
	entries, err := os.ReadDir(dir)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"images": []string{}})
		return
	}

	urls := make([]string, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() {
			urls = append(urls, fmt.Sprintf("/uploads/mobile-tmp/%s/%s", session, entry.Name()))
		}
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
