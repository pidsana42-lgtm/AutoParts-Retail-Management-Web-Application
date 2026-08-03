package wms

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type GradeRepository interface {
	Create(grade *entity.Grade) error
	GetByID(id uint) (*entity.Grade, error)
	List() ([]entity.Grade, error)
	Update(grade *entity.Grade) error
	Delete(id uint) error
}

type gradeRepository struct {
	db *gorm.DB
}

func NewGradeRepository(db *gorm.DB) GradeRepository {
	return &gradeRepository{db: db}
}

func (r *gradeRepository) Create(grade *entity.Grade) error {
	return r.db.Create(grade).Error
}

func (r *gradeRepository) GetByID(id uint) (*entity.Grade, error) {
	var grade entity.Grade
	err := r.db.First(&grade, id).Error
	if err != nil {
		return nil, err
	}
	return &grade, nil
}

func (r *gradeRepository) List() ([]entity.Grade, error) {
	var list []entity.Grade
	return list, r.db.Order("created_at desc").Find(&list).Error
}

func (r *gradeRepository) Update(grade *entity.Grade) error {
	return r.db.Save(grade).Error
}

func (r *gradeRepository) Delete(id uint) error {
	return r.db.Delete(&entity.Grade{}, id).Error
}
