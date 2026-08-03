package wms

import (
	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
)

type ShelfLevelService interface {
	Create(req *wmsDto.ShelfLevelRequestDTO) error
	Update(id uint, req *wmsDto.ShelfLevelUpdateDTO) error
	Delete(id uint) error
}

type shelfLevelService struct {
	repo wmsRepo.ShelfLevelRepository
}

func NewShelfLevelService(repo wmsRepo.ShelfLevelRepository) ShelfLevelService {
	return &shelfLevelService{repo: repo}
}

func (s *shelfLevelService) Create(req *wmsDto.ShelfLevelRequestDTO) error {
	level := entity.ShelfLevel{
		Level_Name: req.Level_Name,
		ShelfID:    req.ShelfID,
	}
	return s.repo.Create(&level)
}

func (s *shelfLevelService) Update(id uint, req *wmsDto.ShelfLevelUpdateDTO) error {
	level, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Level_Name != "" {
		level.Level_Name = req.Level_Name
	}
	if req.ShelfID != 0 {
		level.ShelfID = req.ShelfID
	}
	return s.repo.Update(level)
}

func (s *shelfLevelService) Delete(id uint) error {
	return s.repo.Delete(id)
}
