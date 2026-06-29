package wms

import (
	wmsDto  "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
	"backend/internal/app/entity"
)

type CheckStockScheduleService interface {
	CreateSchedule(req *wmsDto.CheckStockScheduleRequestDTO) error
	GetByID(id uint) (*wmsDto.CheckStockScheduleResponseDTO, error)
	UpdateStatus(id uint, status string) error
	Delete(id uint) error
	List(status string) ([]wmsDto.CheckStockScheduleResponseDTO, error)
}

type checkStockScheduleService struct {
	repo wmsRepo.CheckStockScheduleRepository
}

func NewCheckStockScheduleService(repo wmsRepo.CheckStockScheduleRepository) CheckStockScheduleService {
	return &checkStockScheduleService{repo: repo}
}

func (s *checkStockScheduleService) CreateSchedule(req *wmsDto.CheckStockScheduleRequestDTO) error {
	schedule := entity.CheckStockSchedule{
		Scheduled_DateTime: req.Scheduled_DateTime,
		Status:             "pending",
		Note:               req.Note,
	}
	return s.repo.Create(&schedule)
}

func (s *checkStockScheduleService) GetByID(id uint) (*wmsDto.CheckStockScheduleResponseDTO, error) {
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toResponse(sc), nil
}

func (s *checkStockScheduleService) UpdateStatus(id uint, status string) error {
	return s.repo.UpdateStatus(id, status)
}

func (s *checkStockScheduleService) Delete(id uint) error {
	return s.repo.Delete(id)
}

func (s *checkStockScheduleService) List(status string) ([]wmsDto.CheckStockScheduleResponseDTO, error) {
	schedules, err := s.repo.List(status)
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.CheckStockScheduleResponseDTO, len(schedules))
	for i, sc := range schedules {
		result[i] = *toResponse(&sc)
	}
	return result, nil
}

func toResponse(sc *entity.CheckStockSchedule) *wmsDto.CheckStockScheduleResponseDTO {
	return &wmsDto.CheckStockScheduleResponseDTO{
		ID:                 sc.ID,
		Scheduled_DateTime: sc.Scheduled_DateTime,
		Status:             sc.Status,
		Note:               sc.Note,
		CreatedAt:          sc.CreatedAt,
	}
}
