package wms

import (
	"errors"
	"fmt"
	"time"

	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"

	"gorm.io/gorm"
)

type CheckStockScheduleService interface {
	CreateSchedule(req *wmsDto.CheckStockScheduleRequestDTO) error
	GetByID(id uint) (*wmsDto.CheckStockScheduleResponseDTO, error)
	Update(id uint, req *wmsDto.CheckStockScheduleRequestDTO) error
	UpdateStatus(id uint, status string) error
	Delete(id uint) error
	List(status string) ([]wmsDto.CheckStockScheduleResponseDTO, error)
	ListEmployees() ([]entity.User, error)
	GetZoneTree() ([]entity.Zone, error)
	GetCategoryTree() ([]entity.Category, error)
}

type checkStockScheduleService struct {
	repo wmsRepo.CheckStockScheduleRepository
	db   *gorm.DB // injected to do simple lookups for UI names and counts
}

func NewCheckStockScheduleService(repo wmsRepo.CheckStockScheduleRepository, db *gorm.DB) CheckStockScheduleService {
	return &checkStockScheduleService{repo: repo, db: db}
}

func (s *checkStockScheduleService) CreateSchedule(req *wmsDto.CheckStockScheduleRequestDTO) error {
	schedule := entity.CheckStockSchedule{
		Scheduled_DateTime: req.Scheduled_DateTime,
		Status:             "รอดำเนินการ",
		Note:               req.Note,
		CheckType:          req.CheckType,
		ZoneID:             req.ZoneID,
		ShelfID:            req.ShelfID,
		ShelfLevelID:       req.ShelfLevelID,
		CategoryID:         req.CategoryID,
		SubCategoryID:      req.SubCategoryID,
		SubSubCategoryID:   req.SubSubCategoryID,
		ProductID:          req.ProductID,
		UserID:             req.UserID,
	}
	return s.repo.Create(&schedule)
}

func (s *checkStockScheduleService) Update(id uint, req *wmsDto.CheckStockScheduleRequestDTO) error {
	schedule, err := s.repo.GetByID(id)
	if err != nil {
		return err
	}
	// Check if editable
	if schedule.Status != "รอดำเนินการ" || time.Now().After(schedule.Scheduled_DateTime) {
		return errors.New("cannot edit schedule that has already started or is completed")
	}

	schedule.Scheduled_DateTime = req.Scheduled_DateTime
	schedule.Note = req.Note
	schedule.CheckType = req.CheckType
	schedule.ZoneID = req.ZoneID
	schedule.ShelfID = req.ShelfID
	schedule.ShelfLevelID = req.ShelfLevelID
	schedule.CategoryID = req.CategoryID
	schedule.ProductID = req.ProductID
	schedule.UserID = req.UserID

	return s.repo.Update(schedule)
}

func (s *checkStockScheduleService) GetByID(id uint) (*wmsDto.CheckStockScheduleResponseDTO, error) {
	sc, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return s.toResponse(sc), nil
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
		result[i] = *s.toResponse(&sc)
	}
	return result, nil
}

func (s *checkStockScheduleService) ListEmployees() ([]entity.User, error) {
	var users []entity.User
	err := s.db.Joins("JOIN roles ON roles.id = users.role_id").
		Where("roles.role_name = ?", "Employee").
		Find(&users).Error
	return users, err
}

func (s *checkStockScheduleService) GetZoneTree() ([]entity.Zone, error) {
	var zones []entity.Zone
	err := s.db.Preload("Shelves.ShelfLevels").Find(&zones).Error
	return zones, err
}

func (s *checkStockScheduleService) GetCategoryTree() ([]entity.Category, error) {
	var categories []entity.Category
	err := s.db.Preload("SubCategories.SubSubCategories").Find(&categories).Error
	return categories, err
}

func (s *checkStockScheduleService) toResponse(sc *entity.CheckStockSchedule) *wmsDto.CheckStockScheduleResponseDTO {
	res := &wmsDto.CheckStockScheduleResponseDTO{
		ID:                 sc.ID,
		Scheduled_DateTime: sc.Scheduled_DateTime,
		Status:             sc.Status,
		Note:               sc.Note,
		CreatedAt:          sc.CreatedAt,
		CheckType:          sc.CheckType,
		ZoneID:             sc.ZoneID,
		ShelfID:            sc.ShelfID,
		ShelfLevelID:       sc.ShelfLevelID,
		CategoryID:         sc.CategoryID,
		SubCategoryID:      sc.SubCategoryID,
		SubSubCategoryID:   sc.SubSubCategoryID,
		ProductID:          sc.ProductID,
		UserID:             sc.UserID,
	}

	if sc.User != nil {
		res.UserFullName = sc.User.FirstName + " " + sc.User.LastName
	}

	// Update status dynamically if it's pending but time has passed
	if res.Status == "รอดำเนินการ" && time.Now().After(res.Scheduled_DateTime) {
		res.Status = "กำลังเช็ค"
		// Ideally we should also update the DB, but doing it in presentation is fine for now
	}

	// Derive TargetName and ProductCount based on CheckType
	if sc.CheckType == "LOCATION" && sc.ZoneID != nil {
		var zone entity.Zone
		s.db.First(&zone, sc.ZoneID)
		target := fmt.Sprintf("Zone %s", zone.Zone_Name)
		
		var shelf entity.Shelf
		if sc.ShelfID != nil {
			s.db.First(&shelf, sc.ShelfID)
			target += fmt.Sprintf(" - %s", shelf.Shelf_Name)
		}
		
		var level entity.ShelfLevel
		if sc.ShelfLevelID != nil {
			s.db.First(&level, sc.ShelfLevelID)
			target += fmt.Sprintf(" - %s", level.Level_Name)
		}
		res.TargetName = target

		var count int64
		q := s.db.Model(&entity.Product{})
		if sc.ShelfLevelID != nil {
			q = q.Where("shelf_level_id = ?", sc.ShelfLevelID)
		} else if sc.ShelfID != nil {
			q = q.Where("shelf_id = ?", sc.ShelfID)
		} else {
			q = q.Where("zone_id = ?", sc.ZoneID)
		}
		q.Count(&count)
		res.ProductCount = int(count)

	} else if sc.CheckType == "CATEGORY" {
		if sc.SubSubCategoryID != nil {
			var ssc entity.SubSubCategory
			s.db.First(&ssc, sc.SubSubCategoryID)
			res.TargetName = fmt.Sprintf("หมวดหมู่ย่อยที่สุด: %s", ssc.Sub_Sub_Category_Name)
			var count int64
			s.db.Model(&entity.Product{}).Where("sub_sub_category_id = ?", sc.SubSubCategoryID).Count(&count)
			res.ProductCount = int(count)
		} else if sc.SubCategoryID != nil {
			var subcat entity.SubCategory
			s.db.First(&subcat, sc.SubCategoryID)
			res.TargetName = fmt.Sprintf("หมวดหมู่ย่อย: %s", subcat.Sub_Category_Name)
			var count int64
			s.db.Model(&entity.Product{}).Where("sub_category_id = ?", sc.SubCategoryID).Count(&count)
			res.ProductCount = int(count)
		} else if sc.CategoryID != nil {
			var cat entity.Category
			s.db.First(&cat, sc.CategoryID)
			res.TargetName = fmt.Sprintf("หมวดหมู่: %s", cat.Category_Name)

			var count int64
			s.db.Model(&entity.Product{}).Where("category_id = ?", sc.CategoryID).Count(&count)
			res.ProductCount = int(count)
		}
	} else if sc.CheckType == "PRODUCT" && sc.ProductID != nil {
		var prod entity.Product
		s.db.First(&prod, sc.ProductID)
		res.TargetName = fmt.Sprintf("สินค้า: %s", prod.Product_Name)
		res.ProductCount = 1
	}

	return res
}