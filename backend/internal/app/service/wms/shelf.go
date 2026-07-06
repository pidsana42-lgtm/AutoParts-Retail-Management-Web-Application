package wms

import (
	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
)

type ShelfService interface {
	Create(req *wmsDto.ShelfRequestDTO) error
	GetByID(id uint) (*wmsDto.ShelfResponseDTO, error)
	List() ([]wmsDto.ShelfResponseDTO, error)
	Update(id uint, req *wmsDto.ShelfUpdateDTO) error
	Delete(id uint) error
}

type shelfService struct {
	repo wmsRepo.ShelfRepository
}

func NewShelfService(repo wmsRepo.ShelfRepository) ShelfService {
	return &shelfService{repo: repo}
}

func (s *shelfService) Create(req *wmsDto.ShelfRequestDTO) error {
	shelf := entity.Shelf{
		Shelf_Name: req.Shelf_Name,
		ZoneID:     req.ZoneID,
	}
	return s.repo.Create(&shelf)
}

func (s *shelfService) GetByID(id uint) (*wmsDto.ShelfResponseDTO, error) {
	shelf, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toShelfResponse(shelf), nil
}

func (s *shelfService) List() ([]wmsDto.ShelfResponseDTO, error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.ShelfResponseDTO, len(list))
	for i, shelf := range list {
		result[i] = *toShelfResponse(&shelf)
	}
	return result, nil
}

func (s *shelfService) Update(id uint, req *wmsDto.ShelfUpdateDTO) error {
	shelf, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Shelf_Name != "" {
		shelf.Shelf_Name = req.Shelf_Name
	}
	if req.ZoneID != 0 {
		shelf.ZoneID = req.ZoneID
	}
	return s.repo.Update(shelf)
}

func toShelfResponse(shelf *entity.Shelf) *wmsDto.ShelfResponseDTO {
	return &wmsDto.ShelfResponseDTO{
		ID:         shelf.ID,
		Shelf_Name: shelf.Shelf_Name,
		ZoneID:     shelf.ZoneID,
	}
}

func (s *shelfService) Delete(id uint) error {
	return s.repo.Delete(id)
}
