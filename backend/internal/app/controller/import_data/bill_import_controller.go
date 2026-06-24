package import_data

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"backend/config"
	importDataDTO "backend/internal/app/dto/import_data"
	"backend/internal/app/entity"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func processOCRInBackground(jobID uint, fileURL string) {
	// Clean the file URL to a local path if needed
	localPath := fileURL
	if strings.Contains(fileURL, "/uploads/") {
		parts := strings.Split(fileURL, "/uploads/")
		if len(parts) > 1 {
			localPath = filepath.Join("uploads", parts[1])
		}
	} else if strings.HasPrefix(fileURL, "uploads/") {
		localPath = fileURL
	}

	log.Printf("[OCR] Starting job %d for file %s (resolved: %s)\n", jobID, fileURL, localPath)

	cmd := exec.Command("python3", "model/main.py", localPath)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	db := config.DB()
	var job entity.BillImportJob
	if errFind := db.First(&job, jobID).Error; errFind != nil {
		log.Printf("[OCR] Error finding job %d in database: %v\n", jobID, errFind)
		return
	}

	if err != nil {
		log.Printf("[OCR] Job %d failed: %v, stderr: %s\n", jobID, err, stderr.String())
		job.Status = "failed"
		job.ErrorMessage = fmt.Sprintf("Python execution error: %v\nStderr: %s", err, stderr.String())
		if errSave := db.Save(&job).Error; errSave != nil {
			log.Printf("[OCR] Error saving job %d status: %v\n", jobID, errSave)
		}
		return
	}

	rawJSON := stdout.String()
	// Parse JSON to extract ocr_text for RawModelOutput
	var extracted map[string]interface{}
	var ocrText string
	if errJSON := json.Unmarshal([]byte(rawJSON), &extracted); errJSON == nil {
		if text, ok := extracted["ocr_text"].(string); ok {
			ocrText = text
		}
	}

	job.Status = "processed"
	job.DraftJSON = rawJSON
	job.RawModelOutput = ocrText
	job.ErrorMessage = ""

	if errSave := db.Save(&job).Error; errSave != nil {
		log.Printf("[OCR] Error saving job %d results: %v\n", jobID, errSave)
	} else {
		log.Printf("[OCR] Job %d successfully processed\n", jobID)
	}
}

func CreateBillImportJob(c *gin.Context) {
	var input importDataDTO.CreateBillImportJobDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	job := input.ToEntity()
	job.Status = "pending" // Set status to pending initially
	
	if err := config.DB().Create(&job).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bill import job: " + err.Error()})
		return
	}

	// Trigger OCR processing in background
	go processOCRInBackground(job.ID, job.FileURL)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Created successfully, OCR processing started",
		"data":    importDataDTO.ToBillImportJobResponseDTO(&job),
	})
}

func GetBillImportJob(c *gin.Context) {
	var job entity.BillImportJob

	if err := config.DB().First(&job, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill import job not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": importDataDTO.ToBillImportJobResponseDTO(&job)})
}

func ConfirmBillImport(c *gin.Context) {
	var input importDataDTO.ConfirmBillImportDTO

	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid input: " + err.Error()})
		return
	}

	var job entity.BillImportJob
	if err := config.DB().First(&job, c.Param("id")).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Bill import job not found"})
		return
	}

	var bill entity.Bill
	var billItems []entity.BillItem

	err := config.DB().Transaction(func(tx *gorm.DB) error {
		bill = input.Bill.ToEntity()
		if err := tx.Create(&bill).Error; err != nil {
			return err
		}

		billItems = make([]entity.BillItem, 0, len(input.Items))
		for _, itemInput := range input.Items {
			item := itemInput.ToEntity()
			item.BillID = bill.ID
			if err := tx.Create(&item).Error; err != nil {
				return err
			}
			billItems = append(billItems, item)
		}

		now := time.Now()
		job.Status = "confirmed"
		job.ConfirmedBillID = &bill.ID
		job.ConfirmedAt = &now
		if input.DraftJSON != "" {
			job.DraftJSON = input.DraftJSON
		}

		return tx.Save(&job).Error
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to confirm bill import: " + err.Error()})
		return
	}

	itemResponses := make([]importDataDTO.BillItemResponseDTO, 0, len(billItems))
	for i := range billItems {
		itemResponses = append(itemResponses, importDataDTO.ToBillItemResponseDTO(&billItems[i]))
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Confirmed successfully",
		"data": importDataDTO.ConfirmBillImportResponseDTO{
			Job:   importDataDTO.ToBillImportJobResponseDTO(&job),
			Bill:  importDataDTO.ToBillResponseDTO(&bill),
			Items: itemResponses,
		},
	})
}
