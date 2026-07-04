package wms

import (
	"time"

	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
)

type StockMovementService interface {
	Create(req *wmsDto.StockMovementRequestDTO) error
	GetByID(id uint) (*wmsDto.StockMovementResponseDTO, error)
	List(movementType string, from, to *time.Time) ([]wmsDto.StockMovementResponseDTO, error)
}

type stockMovementService struct {
	repo wmsRepo.StockMovementRepository
}

func NewStockMovementService(repo wmsRepo.StockMovementRepository) StockMovementService {
	return &stockMovementService{repo: repo}
}

func (s *stockMovementService) Create(req *wmsDto.StockMovementRequestDTO) error {
	sm := entity.StockMovement{
		Movement_Type:     req.Movement_Type,
		Quantity:          req.Quantity,
		Movement_DateTime: req.Movement_DateTime,
		Note:              req.Note,
		ProductID:         req.ProductID,
		UserID:            req.UserID,
	}
	if req.SupplierID != nil {
		sm.SupplierID = req.SupplierID
	}
	if req.SaleOrderID != nil {
		sm.SaleOrderID = req.SaleOrderID
	}
	if req.BillID != nil {
		sm.BillID = req.BillID
	}
	return s.repo.Create(&sm)
}

func (s *stockMovementService) GetByID(id uint) (*wmsDto.StockMovementResponseDTO, error) {
	sm, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toMovementResponse(sm), nil
}

func (s *stockMovementService) List(movementType string, from, to *time.Time) ([]wmsDto.StockMovementResponseDTO, error) {
	list, err := s.repo.List(movementType, from, to)
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.StockMovementResponseDTO, len(list))
	for i, sm := range list {
		result[i] = *toMovementResponse(&sm)
	}
	return result, nil
}

func toMovementResponse(sm *entity.StockMovement) *wmsDto.StockMovementResponseDTO {
	res := &wmsDto.StockMovementResponseDTO{
		ID:                sm.ID,
		Movement_Type:     sm.Movement_Type,
		Quantity:          sm.Quantity,
		Movement_DateTime: sm.Movement_DateTime,
		Note:              sm.Note,
		ProductID:         sm.ProductID,
		UserID:            sm.UserID,
		CreatedAt:         sm.CreatedAt,
	}
	if sm.Product != nil {
		res.ProductName = sm.Product.Product_Name
	}
	if sm.Supplier != nil {
		res.SupplierName = sm.Supplier.SupplierName
	}
	if sm.SupplierID != nil {
		res.SupplierID = sm.SupplierID
	}
	if sm.SaleOrderID != nil {
		res.SaleOrderID = sm.SaleOrderID
	}
	if sm.BillID != nil {
		res.BillID = sm.BillID
	}
	return res
}
