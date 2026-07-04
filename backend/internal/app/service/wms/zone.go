package wms

import (
	"backend/internal/app/entity"
	wmsDto "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type ZoneService interface {
	Create(req *wmsDto.ZoneRequestDTO) error
	GetByID(id uint) (*wmsDto.ZoneResponseDTO, error)
	List() ([]wmsDto.ZoneResponseDTO, error)
	Update(id uint, req *wmsDto.ZoneUpdateDTO) error
	Delete(id uint) error
}

type zoneService struct {
	repo wmsRepo.ZoneRepository
}

func NewZoneService(repo wmsRepo.ZoneRepository) ZoneService {
	return &zoneService{repo: repo}
}

func (s *zoneService) Create(req *wmsDto.ZoneRequestDTO) error {
	zone := entity.Zone{
		Zone_Name: req.Zone_Name,
	}
	return s.repo.Create(&zone)
}

func (s *zoneService) GetByID(id uint) (*wmsDto.ZoneResponseDTO, error) {
	zone, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toZoneResponse(zone), nil
}

func (s *zoneService) List() ([]wmsDto.ZoneResponseDTO, error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.ZoneResponseDTO, len(list))
	for i, zone := range list {
		result[i] = *toZoneResponse(&zone)
	}
	return result, nil
}

func (s *zoneService) Update(id uint, req *wmsDto.ZoneUpdateDTO) error {
	zone, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Zone_Name != "" {
		zone.Zone_Name = req.Zone_Name
	}
	return s.repo.Update(zone)
}	

func toZoneResponse(zone *entity.Zone) *wmsDto.ZoneResponseDTO {
	return &wmsDto.ZoneResponseDTO{
		ID:         zone.ID,
		Zone_Name: zone.Zone_Name,
	}
}

func (s *zoneService) Delete(id uint) error {
	return s.repo.Delete(id)
}