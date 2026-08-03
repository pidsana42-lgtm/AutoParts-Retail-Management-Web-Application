package wms

import (
	"backend/internal/app/entity"
	wmsDto "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type GradeService interface {
	Create(req *wmsDto.GradeRequestDTO) error
	GetByID(id uint) (*wmsDto.GradeResponseDTO, error)
	List() ([]wmsDto.GradeResponseDTO, error)
	Update(id uint, req *wmsDto.GradeUpdateDTO) error
	Delete(id uint) error
}

type gradeService struct {
	repo wmsRepo.GradeRepository
}

func NewGradeService(repo wmsRepo.GradeRepository) GradeService {
	return &gradeService{repo: repo}
}

func (s *gradeService) Create(req *wmsDto.GradeRequestDTO) error {
	grade := entity.Grade{
		Grade_Name: req.Grade_Name,
	}
	return s.repo.Create(&grade)
}

func (s *gradeService) GetByID(id uint) (*wmsDto.GradeResponseDTO, error) {
	grade, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toGradeResponse(grade), nil
}

func (s *gradeService) List() ([]wmsDto.GradeResponseDTO, error) {
	list, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.GradeResponseDTO, len(list))
	for i, grade := range list {
		result[i] = *toGradeResponse(&grade)
	}
	return result, nil
}

func (s *gradeService) Update(id uint, req *wmsDto.GradeUpdateDTO) error {
	grade, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	if req.Grade_Name != "" {
		grade.Grade_Name = req.Grade_Name
	}
	return s.repo.Update(grade)
}	

func toGradeResponse(grade *entity.Grade) *wmsDto.GradeResponseDTO {
	return &wmsDto.GradeResponseDTO{
		ID:         grade.ID,
		Grade_Name: grade.Grade_Name,
	}
}

func (s *gradeService) Delete(id uint) error {
	return s.repo.Delete(id)
}
