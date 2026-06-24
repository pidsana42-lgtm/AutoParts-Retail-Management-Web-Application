package import_data

import (
	"time"

	"backend/internal/app/entity"
)

type CreateBillImportJobDTO struct {
	FileURL        string `json:"file_url" binding:"required"`
	FileType       string `json:"file_type" binding:"required"`
	Status         string `json:"status"`
	RawModelOutput string `json:"raw_model_output"`
	DraftJSON      string `json:"draft_json"`
	ErrorMessage   string `json:"error_message"`
	CreatedBy      uint   `json:"created_by" binding:"required"`
}

type BillImportJobResponseDTO struct {
	ID              uint       `json:"id"`
	FileURL         string     `json:"file_url"`
	FileType        string     `json:"file_type"`
	Status          string     `json:"status"`
	RawModelOutput  string     `json:"raw_model_output"`
	DraftJSON       string     `json:"draft_json"`
	ErrorMessage    string     `json:"error_message"`
	CreatedBy       uint       `json:"created_by"`
	ConfirmedBillID *uint      `json:"confirmed_bill_id,omitempty"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

type ConfirmBillImportDTO struct {
	Bill      CreateBillDTO       `json:"bill" binding:"required"`
	Items     []CreateBillItemDTO `json:"items" binding:"required"`
	DraftJSON string              `json:"draft_json"`
}

type ConfirmBillImportResponseDTO struct {
	Job   BillImportJobResponseDTO `json:"job"`
	Bill  BillResponseDTO          `json:"bill"`
	Items []BillItemResponseDTO    `json:"items"`
}

func (d *CreateBillImportJobDTO) ToEntity() entity.BillImportJob {
	status := d.Status
	if status == "" {
		status = "processed"
	}

	return entity.BillImportJob{
		FileURL:        d.FileURL,
		FileType:       d.FileType,
		Status:         status,
		RawModelOutput: d.RawModelOutput,
		DraftJSON:      d.DraftJSON,
		ErrorMessage:   d.ErrorMessage,
		CreatedBy:      d.CreatedBy,
	}
}

func ToBillImportJobResponseDTO(m *entity.BillImportJob) BillImportJobResponseDTO {
	return BillImportJobResponseDTO{
		ID:              m.ID,
		FileURL:         m.FileURL,
		FileType:        m.FileType,
		Status:          m.Status,
		RawModelOutput:  m.RawModelOutput,
		DraftJSON:       m.DraftJSON,
		ErrorMessage:    m.ErrorMessage,
		CreatedBy:       m.CreatedBy,
		ConfirmedBillID: m.ConfirmedBillID,
		ConfirmedAt:     m.ConfirmedAt,
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}
