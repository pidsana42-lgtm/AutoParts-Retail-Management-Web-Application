package wms

import (
	"backend/internal/app/entity"
	wmsDto "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type UnitService interface {
	Create(req *wmsDto.UnitRequestDTO) error
	GetByID(id uint) (*wmsDto.UnitResponseDTO, error)
	List() ([]wmsDto.UnitResponseDTO, error)
	Update(id uint, req *wmsDto.UnitUpdateDTO) error
	Delete(id uint) error
}

type unitService struct {
	repo wmsRepo.UnitRepository
}

func NewUnitService(repo wmsRepo.UnitRepository) UnitService {
	return &unitService{repo: repo}
}

func (s *unitService) Create(req *wmsDto.UnitRequestDTO) error {
	unit := entity.Unit{
		Unit_Name: req.Unit_Name,
	}
	return s.repo.Create(&unit)
}

func (s *unitService) GetByID(id uint) (*wmsDto.UnitResponseDTO, error) {
	unit, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toUnitResponse(unit), nil
}

func (s *unitService) List() ([]wmsDto.UnitResponseDTO, error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.UnitResponseDTO, len(list))
	for i, unit := range list {
		result[i] = *toUnitResponse(&unit)
	}
	return result, nil
}

func (s *unitService) Update(id uint, req *wmsDto.UnitUpdateDTO) error {
	unit, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Unit_Name != "" {
		unit.Unit_Name = req.Unit_Name
	}
	return s.repo.Update(unit)
}	

func toUnitResponse(unit *entity.Unit) *wmsDto.UnitResponseDTO {
	return &wmsDto.UnitResponseDTO{
		ID:        unit.ID,
		Unit_Name: unit.Unit_Name,
	}
}

func (s *unitService) Delete(id uint) error {
	return s.repo.Delete(id)
}