package claim

import (
	"time"

	"backend/internal/app/entity"
)

type CreateSalesReturnDTO struct {
	ReturnNumber    string     `json:"return_number" binding:"required"`
	OriginalOrderID uint       `json:"original_order_id" binding:"required"`
	ReturnDate      time.Time  `json:"return_date" binding:"required"`
	Reason          string     `json:"reason" binding:"required"`
	RefundAmount    float64    `json:"refund_amount" binding:"required"`
	RefundMethod    string     `json:"refund_method" binding:"required"`
	RequestedAt     time.Time  `json:"requested_at" binding:"required"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	Note            string     `json:"note,omitempty"`
	CreatedBy       uint       `json:"created_by" binding:"required"`
	ApprovedBy      *uint      `json:"approved_by,omitempty"`
}

type UpdateSalesReturnDTO struct {
	ReturnDate   time.Time  `json:"return_date"`
	Reason       string     `json:"reason"`
	RefundAmount float64    `json:"refund_amount"`
	RefundMethod string     `json:"refund_method"`
	ApprovedAt   *time.Time `json:"approved_at,omitempty"`
	Note         string     `json:"note,omitempty"`
	ApprovedBy   *uint      `json:"approved_by,omitempty"`
}

type SalesReturnResponseDTO struct {
	ID              uint       `json:"id"`
	ReturnNumber    string     `json:"return_number"`
	OriginalOrderID uint       `json:"original_order_id"`
	ReturnDate      time.Time  `json:"return_date"`
	Reason          string     `json:"reason"`
	RefundAmount    float64    `json:"refund_amount"`
	RefundMethod    string     `json:"refund_method"`
	RequestedAt     time.Time  `json:"requested_at"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	Note            string     `json:"note,omitempty"`
	CreatedBy       uint       `json:"created_by"`
	ApprovedBy      *uint      `json:"approved_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (d *CreateSalesReturnDTO) ToEntity() entity.SalesReturn {
	return entity.SalesReturn{
		ReturnNumber:    d.ReturnNumber,
		OriginalOrderID: d.OriginalOrderID,
		ReturnDate:      d.ReturnDate,
		Reason:          d.Reason,
		RefundAmount:    d.RefundAmount,
		RefundMethod:    d.RefundMethod,
		RequestedAt:     d.RequestedAt,
		ApprovedAt:      d.ApprovedAt,
		Note:            d.Note,
		CreatedBy:       d.CreatedBy,
		ApprovedBy:      d.ApprovedBy,
	}
}

func (d *UpdateSalesReturnDTO) ToEntity(existing entity.SalesReturn) entity.SalesReturn {
	if !d.ReturnDate.IsZero() {
		existing.ReturnDate = d.ReturnDate
	}
	if d.Reason != "" {
		existing.Reason = d.Reason
	}
	if d.RefundAmount > 0 {
		existing.RefundAmount = d.RefundAmount
	}
	if d.RefundMethod != "" {
		existing.RefundMethod = d.RefundMethod
	}
	existing.ApprovedAt = d.ApprovedAt
	if d.Note != "" {
		existing.Note = d.Note
	}
	existing.ApprovedBy = d.ApprovedBy
	return existing
}

func ToSalesReturnResponseDTO(m *entity.SalesReturn) SalesReturnResponseDTO {
	return SalesReturnResponseDTO{
		ID:              m.ID,
		ReturnNumber:    m.ReturnNumber,
		OriginalOrderID: m.OriginalOrderID,
		ReturnDate:      m.ReturnDate,
		Reason:          m.Reason,
		RefundAmount:    m.RefundAmount,
		RefundMethod:    m.RefundMethod,
		RequestedAt:     m.RequestedAt,
		ApprovedAt:      m.ApprovedAt,
		Note:            m.Note,
		CreatedBy:       m.CreatedBy,
		ApprovedBy:      m.ApprovedBy,
		CreatedAt:       m.CreatedAt,
		UpdatedAt:       m.UpdatedAt,
	}
}
