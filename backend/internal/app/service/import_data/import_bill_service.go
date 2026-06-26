package import_data

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
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
	job, err := s.repo.GetBillImportJobByID(id)
	if err != nil {
		return importDataDTO.ConfirmBillImportResponseDTO{}, err
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

	cmd := exec.Command("python3", "model/main.py", localPath)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	job, errFind := s.repo.GetBillImportJobByID(jobID)
	if errFind != nil {
		log.Printf("[OCR] Error finding job %d in database: %v\n", jobID, errFind)
		return
	}

	if err != nil {
		log.Printf("[OCR] Job %d failed: %v, stderr: %s\n", jobID, err, stderr.String())
		job.Status = "failed"
		job.ErrorMessage = fmt.Sprintf("Python execution error: %v\nStderr: %s", err, stderr.String())
		if errSave := s.repo.SaveBillImportJob(job); errSave != nil {
			log.Printf("[OCR] Error saving job %d status: %v\n", jobID, errSave)
		}
		return
	}

	rawJSON := stdout.String()
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

	if errSave := s.repo.SaveBillImportJob(job); errSave != nil {
		log.Printf("[OCR] Error saving job %d results: %v\n", jobID, errSave)
	} else {
		log.Printf("[OCR] Job %d successfully processed\n", jobID)
	}
}
