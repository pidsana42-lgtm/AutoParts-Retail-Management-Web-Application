package import_data

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	importDataDTO "backend/internal/app/dto/import_data"
	"backend/internal/app/entity"
	billRepo "backend/internal/app/repository/import_data"
)

type ImportBillService interface {
	CreateBill(input importDataDTO.CreateBillDTO) (importDataDTO.BillResponseDTO, error)
	ListBills() ([]importDataDTO.BillResponseDTO, error)
	CreateBillImage(input importDataDTO.CreateBillImageDTO) (importDataDTO.BillImageResponseDTO, error)
	CreateBillImportJob(input importDataDTO.CreateBillImportJobDTO) (importDataDTO.BillImportJobResponseDTO, error)
	GetBillImportJob(id uint) (importDataDTO.BillImportJobResponseDTO, error)
	ConfirmBillImport(id uint, input importDataDTO.ConfirmBillImportDTO) (importDataDTO.ConfirmBillImportResponseDTO, error)
	CreateBillItem(input importDataDTO.CreateBillItemDTO) (importDataDTO.BillItemResponseDTO, error)
	UpdateBill(id uint, input importDataDTO.ConfirmBillImportDTO) (importDataDTO.BillResponseDTO, error)
	DeleteBill(id uint) error
}

type importBillService struct {
	repo billRepo.BillRepository
}

func NewImportBillService(repo billRepo.BillRepository) ImportBillService {
	return &importBillService{repo: repo}
}

func (s *importBillService) CreateBill(input importDataDTO.CreateBillDTO) (importDataDTO.BillResponseDTO, error) {
	bill := input.ToEntity()
	err := s.repo.CreateBill(&bill)
	if err != nil {
		return importDataDTO.BillResponseDTO{}, err
	}
	return importDataDTO.ToBillResponseDTO(&bill), nil
}

func (s *importBillService) ListBills() ([]importDataDTO.BillResponseDTO, error) {
	bills, err := s.repo.ListBills()
	if err != nil {
		return nil, err
	}
	response := make([]importDataDTO.BillResponseDTO, len(bills))
	for i := range bills {
		response[i] = importDataDTO.ToBillResponseDTO(&bills[i])
	}
	return response, nil
}

func (s *importBillService) CreateBillImage(input importDataDTO.CreateBillImageDTO) (importDataDTO.BillImageResponseDTO, error) {
	img := input.ToEntity()
	err := s.repo.CreateBillImage(&img)
	if err != nil {
		return importDataDTO.BillImageResponseDTO{}, err
	}
	return importDataDTO.ToBillImageResponseDTO(&img), nil
}

func (s *importBillService) CreateBillImportJob(input importDataDTO.CreateBillImportJobDTO) (importDataDTO.BillImportJobResponseDTO, error) {
	job := input.ToEntity()
	job.Status = "pending"

	err := s.repo.CreateBillImportJob(&job)
	if err != nil {
		return importDataDTO.BillImportJobResponseDTO{}, err
	}

	// Trigger OCR processing in background
	go s.processOCRInBackground(job.ID, job.FileURL)

	return importDataDTO.ToBillImportJobResponseDTO(&job), nil
}

func (s *importBillService) GetBillImportJob(id uint) (importDataDTO.BillImportJobResponseDTO, error) {
	job, err := s.repo.GetBillImportJobByID(id)
	if err != nil {
		return importDataDTO.BillImportJobResponseDTO{}, err
	}
	return importDataDTO.ToBillImportJobResponseDTO(job), nil
}

func (s *importBillService) CreateBillItem(input importDataDTO.CreateBillItemDTO) (importDataDTO.BillItemResponseDTO, error) {
	item := input.ToEntity()
	err := s.repo.CreateBillItem(&item)
	if err != nil {
		return importDataDTO.BillItemResponseDTO{}, err
	}
	return importDataDTO.ToBillItemResponseDTO(&item), nil
}

func (s *importBillService) ConfirmBillImport(id uint, input importDataDTO.ConfirmBillImportDTO) (importDataDTO.ConfirmBillImportResponseDTO, error) {
	var job *entity.BillImportJob
	var err error
	if id > 0 {
		job, err = s.repo.GetBillImportJobByID(id)
	}

	if id == 0 || err != nil {
		// Placeholder job for manual/CSV entries
		job = &entity.BillImportJob{
			FileURL:   "manual_entry",
			FileType:  "invoice",
			Status:    "pending",
		}
		if errCreate := s.repo.CreateBillImportJob(job); errCreate != nil {
			return importDataDTO.ConfirmBillImportResponseDTO{}, errCreate
		}
	}

	bill := input.Bill.ToEntity()
	billItems := make([]entity.BillItem, len(input.Items))
	for i, itemInput := range input.Items {
		billItems[i] = itemInput.ToEntity()
	}

	now := time.Now()
	job.Status = "confirmed"
	job.ConfirmedBillID = &bill.ID
	job.ConfirmedAt = &now
	if input.DraftJSON != "" {
		job.DraftJSON = input.DraftJSON
	}

	err = s.repo.ConfirmBillImportTransaction(&bill, billItems, job)
	if err != nil {
		return importDataDTO.ConfirmBillImportResponseDTO{}, err
	}

	// Trigger QR and Barcode generation on FastAPI using internal product IDs
	var productIDs []uint
	seenIDs := make(map[uint]bool)
	for _, item := range billItems {
		if item.ProductID > 0 && !seenIDs[item.ProductID] {
			seenIDs[item.ProductID] = true
			productIDs = append(productIDs, item.ProductID)
		}
	}
	if len(productIDs) > 0 {
		go func(ids []uint) {
			payload := map[string]interface{}{
				"product_ids": ids,
			}
			jsonPayload, errPayload := json.Marshal(payload)
			if errPayload != nil {
				log.Printf("[WMS] Error marshaling product IDs payload: %v\n", errPayload)
				return
			}
			client := http.Client{
				Timeout: 15 * time.Second,
			}
			fastAPIURL := "http://localhost:8000/api/products/generate-codes"
			resp, errReq := client.Post(fastAPIURL, "application/json", bytes.NewBuffer(jsonPayload))
			if errReq != nil {
				log.Printf("[WMS] Error calling FastAPI to generate product codes: %v\n", errReq)
				return
			}
			defer resp.Body.Close()
			log.Printf("[WMS] FastAPI product codes generation response status: %d\n", resp.StatusCode)
		}(productIDs)
	}

	itemResponses := make([]importDataDTO.BillItemResponseDTO, len(billItems))
	for i := range billItems {
		itemResponses[i] = importDataDTO.ToBillItemResponseDTO(&billItems[i])
	}

	return importDataDTO.ConfirmBillImportResponseDTO{
		Job:   importDataDTO.ToBillImportJobResponseDTO(job),
		Bill:  importDataDTO.ToBillResponseDTO(&bill),
		Items: itemResponses,
	}, nil
}

func (s *importBillService) UpdateBill(id uint, input importDataDTO.ConfirmBillImportDTO) (importDataDTO.BillResponseDTO, error) {
	bill := input.Bill.ToEntity()
	bill.ID = id
	billItems := make([]entity.BillItem, len(input.Items))
	for i, itemInput := range input.Items {
		billItems[i] = itemInput.ToEntity()
		billItems[i].BillID = id
	}

	err := s.repo.UpdateBill(id, &bill, billItems)
	if err != nil {
		return importDataDTO.BillResponseDTO{}, err
	}

	return importDataDTO.ToBillResponseDTO(&bill), nil
}

func (s *importBillService) DeleteBill(id uint) error {
	return s.repo.DeleteBill(id)
}

func (s *importBillService) processOCRInBackground(jobID uint, fileURL string) {
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

	job, errFind := s.repo.GetBillImportJobByID(jobID)
	if errFind != nil {
		log.Printf("[OCR] Error finding job %d in database: %v\n", jobID, errFind)
		return
	}

	var rawJSON string
	var ocrText string
	var isFastAPISuccess bool

	// 1. Try sending Request to FastAPI Server first
	fastAPIURL := "http://localhost:8000/api/extract-invoice"
	payload := map[string]interface{}{
		"file_path": localPath,
		"job_id":    jobID,
	}
	jsonPayload, errPayload := json.Marshal(payload)
	if errPayload == nil {
		client := http.Client{
			Timeout: 60 * time.Second,
		}
		log.Printf("[OCR] Attempting FastAPI OCR processing for job %d...\n", jobID)
		resp, errReq := client.Post(fastAPIURL, "application/json", bytes.NewBuffer(jsonPayload))
		if errReq == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				bodyBytes, errRead := io.ReadAll(resp.Body)
				if errRead == nil {
					rawJSON = string(bodyBytes)
					isFastAPISuccess = true
					log.Printf("[OCR] Successfully processed job %d via FastAPI\n", jobID)
				}
			} else {
				log.Printf("[OCR] FastAPI returned non-OK status: %d\n", resp.StatusCode)
			}
		} else {
			log.Printf("[OCR] Failed to connect to FastAPI: %v\n", errReq)
		}
	}

	// 2. Fallback to CLI Python script execution if FastAPI failed
	if !isFastAPISuccess {
		log.Printf("[OCR] Falling back to CLI execution for job %d\n", jobID)
		cmd := exec.Command("python3", "model/main.py", localPath)
		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		err := cmd.Run()
		if err != nil {
			log.Printf("[OCR] Job %d failed (both FastAPI & CLI): %v, stderr: %s\n", jobID, err, stderr.String())
			job.Status = "failed"
			job.ErrorMessage = fmt.Sprintf("FastAPI request failed and CLI Python execution error: %v\nStderr: %s", err, stderr.String())
			if errSave := s.repo.SaveBillImportJob(job); errSave != nil {
				log.Printf("[OCR] Error saving job %d status: %v\n", jobID, errSave)
			}
			return
		}
		rawJSON = stdout.String()
	}

	var extracted map[string]interface{}
	if errJSON := json.Unmarshal([]byte(rawJSON), &extracted); errJSON == nil {
		if text, ok := extracted["ocr_text"].(string); ok {
			ocrText = text
		}
	}

	job.Status = "processed"
	job.DraftJSON = rawJSON
	job.RawModelOutput = ocrText
	job.ErrorMessage = ""

	if errSave := s.repo.SaveBillImportJob(job); errSave != nil {
		log.Printf("[OCR] Error saving job %d results: %v\n", jobID, errSave)
	} else {
		log.Printf("[OCR] Job %d successfully processed\n", jobID)
	}
}
