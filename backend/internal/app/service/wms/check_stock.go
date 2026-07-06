package wms

import (
	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
)

type CheckStockService interface {
	CreateCheckStock(req *wmsDto.CheckStockRequestDTO) error
	GetByID(id uint) (*wmsDto.CheckStockResponseDTO, error)
	List(scheduleID *uint) ([]wmsDto.CheckStockResponseDTO, error)
}

type checkStockService struct {
	repo         wmsRepo.CheckStockRepository
	scheduleRepo wmsRepo.CheckStockScheduleRepository
}

func NewCheckStockService(repo wmsRepo.CheckStockRepository, scheduleRepo wmsRepo.CheckStockScheduleRepository) CheckStockService {
	return &checkStockService{repo: repo, scheduleRepo: scheduleRepo}
}

func (s *checkStockService) CreateCheckStock(req *wmsDto.CheckStockRequestDTO) error {
	cs := entity.CheckStock{
		Old_Quantity:         req.Old_Quantity,
		New_Quantity:         req.New_Quantity,
		Diff_Quantity:        req.New_Quantity - req.Old_Quantity,
		Reason:               req.Reason,
		Adjustment_DateTime:  req.Adjustment_DateTime,
		ProductID:            &req.ProductID, // required เสมอ
		UserID:               &req.UserID,    // required เสมอ
		CheckStockScheduleID: req.CheckStockScheduleID,
	}
	// supplier_id เป็น optional: ถ้าไม่ส่ง (0) ให้เป็น NULL เลี่ยง FK violation
	if req.SupplierID != 0 {
		cs.SupplierID = &req.SupplierID
	}
	if err := s.repo.Create(&cs); err != nil {
		return err
	}
	// อัพเดต schedule → completed อัตโนมัติ
	if req.CheckStockScheduleID != nil {
		return s.scheduleRepo.UpdateStatus(*req.CheckStockScheduleID, "completed")
	}
	return nil
}

func (s *checkStockService) GetByID(id uint) (*wmsDto.CheckStockResponseDTO, error) {
	cs, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toCheckStockResponse(cs), nil
}

func (s *checkStockService) List(scheduleID *uint) ([]wmsDto.CheckStockResponseDTO, error) {
	list, err := s.repo.List(scheduleID)
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.CheckStockResponseDTO, len(list))
	for i, cs := range list {
		result[i] = *toCheckStockResponse(&cs)
	}
	return result, nil
}

func toCheckStockResponse(cs *entity.CheckStock) *wmsDto.CheckStockResponseDTO {
	res := &wmsDto.CheckStockResponseDTO{
		ID:                   cs.ID,
		Old_Quantity:         cs.Old_Quantity,
		New_Quantity:         cs.New_Quantity,
		Diff_Quantity:        cs.Diff_Quantity,
		Reason:               cs.Reason,
		Adjustment_DateTime:  cs.Adjustment_DateTime,
		CheckStockScheduleID: cs.CheckStockScheduleID,
		CreatedAt:            cs.CreatedAt,
	}
	if cs.ProductID != nil {
		res.ProductID = *cs.ProductID
	}
	if cs.SupplierID != nil {
		res.SupplierID = *cs.SupplierID
	}
	if cs.UserID != nil {
		res.UserID = *cs.UserID
	}
	return res
}
