package import_data

import (
	"bytes"
	"encoding/json"
	"errors"
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
	"backend/internal/app/enum"
	billRepo "backend/internal/app/repository/import_data"
	svcNotification "backend/internal/app/service/notification"
)

// ErrBillDeleteForbidden ใช้เมื่อผู้ใช้ที่ไม่ใช่เจ้าของพยายามลบบิลที่อนุมัติแล้ว
var ErrBillDeleteForbidden = errors.New("FORBIDDEN: พนักงานลบได้เฉพาะบิลที่ยังไม่อนุมัติเท่านั้น")

type ImportBillService interface {
	CreateBill(input importDataDTO.CreateBillDTO) (importDataDTO.BillResponseDTO, error)
	ListBills() ([]importDataDTO.BillResponseDTO, error)
	CreateBillImage(input importDataDTO.CreateBillImageDTO) (importDataDTO.BillImageResponseDTO, error)
	CreateBillImportJob(input importDataDTO.CreateBillImportJobDTO) (importDataDTO.BillImportJobResponseDTO, error)
	GetBillImportJob(id uint) (importDataDTO.BillImportJobResponseDTO, error)
	ConfirmBillImport(id uint, input importDataDTO.ConfirmBillImportDTO, role string) (importDataDTO.ConfirmBillImportResponseDTO, error)
	CreateBillItem(input importDataDTO.CreateBillItemDTO) (importDataDTO.BillItemResponseDTO, error)
	UpdateBill(id uint, input importDataDTO.ConfirmBillImportDTO) (importDataDTO.BillResponseDTO, error)
	DeleteBill(id uint, role string) error
	ListPurchaseOrders() ([]importDataDTO.PurchaseOrderImportDTO, error)
	GetPurchaseOrderByID(id uint) (importDataDTO.PurchaseOrderImportDTO, error)
	UpdateProduct(id uint, input importDataDTO.UpdateImportProductDTO) error
}

type importBillService struct {
	repo         billRepo.ImportBillRepository
	notification svcNotification.NotificationService
}

func NewImportBillService(repo billRepo.ImportBillRepository, notificationService svcNotification.NotificationService) ImportBillService {
	return &importBillService{repo: repo, notification: notificationService}
}

func (s *importBillService) CreateBill(input importDataDTO.CreateBillDTO) (importDataDTO.BillResponseDTO, error) {
	bill := input.ToEntity()
	if bill.VerifiedBy == 0 {
		bill.VerifiedBy = 1
	}
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

func (s *importBillService) ConfirmBillImport(id uint, input importDataDTO.ConfirmBillImportDTO, role string) (importDataDTO.ConfirmBillImportResponseDTO, error) {
	var job *entity.BillImportJob
	var err error
	if id > 0 {
		job, err = s.repo.GetBillImportJobByID(id)
	}

	if id == 0 || err != nil {
		createdBy := input.Bill.VerifiedBy
		if createdBy == 0 {
			createdBy = 1 // Default fallback to user 1
		}
		// Placeholder job for manual/CSV entries
		job = &entity.BillImportJob{
			FileURL:   "manual_entry",
			FileType:  "invoice",
			Status:    "pending",
			CreatedBy: createdBy,
		}
		if errCreate := s.repo.CreateBillImportJob(job); errCreate != nil {
			return importDataDTO.ConfirmBillImportResponseDTO{}, errCreate
		}
	}

	// Resolve supplier_id dynamically by name if supplier_name is provided
	supplierID := input.Bill.SupplierID
	if input.Bill.SupplierName != "" {
		resolvedID, errResolve := s.repo.FindOrCreateSupplierByName(input.Bill.SupplierName)
		if errResolve == nil {
			supplierID = resolvedID
		}
	} else if supplierID == 0 {
		supplierID = 1 // default fallback
	}

	bill := input.Bill.ToEntity()
	bill.SupplierID = supplierID
	if bill.VerifiedBy == 0 {
		bill.VerifiedBy = 1
	}
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

	err = s.repo.ConfirmBillImportTransaction(&bill, billItems, job, role)
	if err != nil {
		return importDataDTO.ConfirmBillImportResponseDTO{}, err
	}

	// บิลยังไม่ถูกอนุมัติอัตโนมัติ (ราคาทุนไม่ตรงกับระบบและผู้ส่งไม่ใช่เจ้าของ) → แจ้งเตือนเจ้าของร้านให้เข้ามาตรวจสอบ
	if !bill.IsVerified && s.notification != nil {
		if errNotify := s.notification.NotifyOwners(
			"IMPORT_BILL_PENDING_APPROVAL",
			"มีบิลนำเข้าสินค้ารออนุมัติ",
			fmt.Sprintf("บิลเลขที่ %s ถูกนำเข้าโดยพนักงาน พบราคาทุนไม่ตรงกับระบบ กรุณาตรวจสอบและอนุมัติ", bill.BillNo),
			"/owner/import-bills",
			nil,
		); errNotify != nil {
			log.Printf("[Notification] failed to notify owners (bill %d): %v\n", bill.ID, errNotify)
		}
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
			fastAPIURL := "http://127.0.0.1:8000/api/products/generate-codes"
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
	// Resolve supplier_id dynamically by name if supplier_name is provided
	supplierID := input.Bill.SupplierID
	if input.Bill.SupplierName != "" {
		resolvedID, errResolve := s.repo.FindOrCreateSupplierByName(input.Bill.SupplierName)
		if errResolve == nil {
			supplierID = resolvedID
		}
	} else if supplierID == 0 {
		supplierID = 1 // default fallback
	}

	bill := input.Bill.ToEntity()
	bill.SupplierID = supplierID
	if bill.VerifiedBy == 0 {
		bill.VerifiedBy = 1
	}
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

func (s *importBillService) DeleteBill(id uint, role string) error {
	// พนักงานลบได้เฉพาะบิลที่ยังไม่อนุมัติ — บิลที่อนุมัติแล้ว (is_verified / payment_status=approved) ลบได้เฉพาะเจ้าของ
	isOwner := strings.EqualFold(role, string(enum.RoleOwner)) || strings.EqualFold(role, string(enum.RoleAdmin))
	if !isOwner {
		bill, err := s.repo.GetBillByID(id)
		if err != nil {
			return err
		}
		if bill.IsVerified || strings.EqualFold(bill.PaymentStatus, "approved") {
			return ErrBillDeleteForbidden
		}
	}
	return s.repo.DeleteBill(id)
}

func (s *importBillService) ListPurchaseOrders() ([]importDataDTO.PurchaseOrderImportDTO, error) {
	pos, err := s.repo.ListPurchaseOrders()
	if err != nil {
		return nil, err
	}
	res := make([]importDataDTO.PurchaseOrderImportDTO, len(pos))
	for i := range pos {
		res[i] = importDataDTO.ToPurchaseOrderImportDTO(&pos[i])
	}
	return res, nil
}

func (s *importBillService) GetPurchaseOrderByID(id uint) (importDataDTO.PurchaseOrderImportDTO, error) {
	po, err := s.repo.GetPurchaseOrderByID(id)
	if err != nil {
		return importDataDTO.PurchaseOrderImportDTO{}, err
	}
	return importDataDTO.ToPurchaseOrderImportDTO(po), nil
}

func (s *importBillService) processOCRInBackground(jobID uint, fileURL string) {
	localPath := fileURL
	if strings.HasPrefix(fileURL, "http://") || strings.HasPrefix(fileURL, "https://") {
		localPath = fileURL
	} else if strings.Contains(fileURL, "/uploads/") {
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
	fastAPIURL := "http://127.0.0.1:8000/api/extract-invoice"
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
			s.notifyBillJobDone(job, false)
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
	s.notifyBillJobDone(job, true)
}

// notifyBillJobDone: แจ้งเตือนกลับไปหาคนที่อัพโหลดบิลนี้ (job.CreatedBy) ว่า OCR ประมวลผลเสร็จแล้ว/ล้มเหลว พร้อมให้เข้าไปตรวจสอบ/ยืนยันต่อ
func (s *importBillService) notifyBillJobDone(job *entity.BillImportJob, success bool) {
	if s.notification == nil || job == nil || job.CreatedBy == 0 {
		return
	}
	title := "ประมวลผลบิลเสร็จแล้ว"
	message := "ระบบอ่านข้อมูลจากบิลที่อัพโหลดเสร็จแล้ว กรุณาตรวจสอบและยืนยันข้อมูลก่อนบันทึกเข้าคลังสินค้า"
	notifType := "BILL_IMPORT_PROCESSED"
	if !success {
		title = "ประมวลผลบิลไม่สำเร็จ"
		message = "ระบบไม่สามารถอ่านข้อมูลจากบิลที่อัพโหลดได้ กรุณาลองอัพโหลดใหม่ หรือกรอกข้อมูลด้วยตนเอง"
		notifType = "BILL_IMPORT_FAILED"
	}
	if err := s.notification.NotifyUser(job.CreatedBy, notifType, title, message, "/owner/import-bills", nil); err != nil {
		log.Printf("[Notification] failed to notify user %d (bill import job %d): %v\n", job.CreatedBy, job.ID, err)
	}
}

func (s *importBillService) UpdateProduct(id uint, input importDataDTO.UpdateImportProductDTO) error {
	prod := entity.Product{
		Product_Code:   input.ProductCode,
		Part_Number:    input.PartNumber,
		Product_Name:   input.ProductName,
		Barcode:        input.Barcode,
		Quantity:       input.Quantity,
		Limit_Quantity: input.LimitQuantity,
		Cost_price:     input.CostPrice,
		Sale_price:     input.SalePrice,
		Note:           input.Note,
		CategoryID:     input.CategoryID,
		GradeID:        input.GradeID,
		UnitID:         input.UnitID,
		ShelfID:        input.ShelfID,
	}
	return s.repo.UpdateImportProduct(id, &prod, input.ModelIDs)
}
