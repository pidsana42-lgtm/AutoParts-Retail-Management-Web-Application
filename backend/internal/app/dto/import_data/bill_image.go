package import_data

import (
	"time"

	"backend/internal/app/entity"
)

type CreateBillImageDTO struct {
	ImageURL string `json:"image_url" binding:"required"`
}

type UpdateBillImageDTO struct {
	ImageURL string `json:"image_url"`
}

type BillImageResponseDTO struct {
	ID        uint      `json:"id"`
	ImageURL  string    `json:"image_url"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (d *CreateBillImageDTO) ToEntity() entity.BillImage {
	return entity.BillImage{
		ImageURL: d.ImageURL,
	}
}

func (d *UpdateBillImageDTO) ToEntity(existing entity.BillImage) entity.BillImage {
	if d.ImageURL != "" {
		existing.ImageURL = d.ImageURL
	}
	return existing
}

func ToBillImageResponseDTO(m *entity.BillImage) BillImageResponseDTO {
	return BillImageResponseDTO{
		ID:        m.ID,
		ImageURL:  m.ImageURL,
		CreatedAt: m.CreatedAt,
		UpdatedAt: m.UpdatedAt,
	}
}
