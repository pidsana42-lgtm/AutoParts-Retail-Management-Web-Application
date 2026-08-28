package pos

import (
	storeconfigDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	storeconfigRepo "backend/internal/app/repository/pos"
	"errors"

	"gorm.io/gorm"
)

type StoreConfigService interface {
	GetStoreConfig() (*storeconfigDto.StoreConfigResponse, error)
	CreateStoreConfig(config *storeconfigDto.StoreConfigRequest) error
	UpdateStoreConfig(config *storeconfigDto.StoreConfigRequest) error
}

type storeConfigService struct {
	repo storeconfigRepo.StoreConfigRepository
}

func NewStoreConfigService(repo storeconfigRepo.StoreConfigRepository) StoreConfigService {
	return &storeConfigService{repo: repo}
}

func (s *storeConfigService) GetStoreConfig() (*storeconfigDto.StoreConfigResponse, error) {
	config, err := s.repo.GetStoreConfig()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// ถ้ายังไม่มีข้อมูลในฐานข้อมูล ให้คืนค่าเริ่มต้นว่างๆ กลับไปก่อน
			return &storeconfigDto.StoreConfigResponse{
				MaxCredit:            0,
				MaxOverdueDays:       0,
				MaxExtraDiscountRate: 0,
				SupervisedPin:        "",
			}, nil
		}
		return nil, err
	}
	return storeconfigDto.ToStoreConfigResponse(config), nil
}

func (s *storeConfigService) CreateStoreConfig(req *storeconfigDto.StoreConfigRequest) error {
	// ตรวจสอบว่ามีข้อมูลอยู่แล้วหรือไม่
	config, err := s.repo.GetStoreConfig()
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	if config != nil && config.ID != 0 {
		// ถ้ามีอยู่แล้ว ให้อัปเดตข้อมูลทับ
		config.MaxCredit = req.MaxCredit
		config.MaxOverdueDays = req.MaxOverdueDays
		config.MaxExtraDiscountRate = req.MaxExtraDiscountRate
		config.SupervisedPin = req.SupervisedPin
		return s.repo.UpdateStoreConfig(config)
	}

	// ถ้ายังไม่มี ให้สร้างใหม่
	newConfig := &entity.StoreConfig{
		MaxCredit:            req.MaxCredit,
		MaxOverdueDays:       req.MaxOverdueDays,
		MaxExtraDiscountRate: req.MaxExtraDiscountRate,
		SupervisedPin:        req.SupervisedPin,
	}
	return s.repo.CreateStoreConfig(newConfig)
}

func (s *storeConfigService) UpdateStoreConfig(req *storeconfigDto.StoreConfigRequest) error {
	// 1. ดึงข้อมูลขึ้นมาดูก่อนว่ามีอยู่แล้วในฐานข้อมูลหรือไม่
	config, err := s.repo.GetStoreConfig()
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 2. ถ้ายังไม่เคยมี ให้ทำการสร้างรายการใหม่เป็นครั้งแรก (Create First Time)
			newConfig := &entity.StoreConfig{
				MaxCredit:            req.MaxCredit,
				MaxOverdueDays:       req.MaxOverdueDays,
				MaxExtraDiscountRate: req.MaxExtraDiscountRate,
				SupervisedPin:        req.SupervisedPin,
			}
			return s.repo.CreateStoreConfig(newConfig)
		}
		return err
	}

	// 3. ถ้ามีอยู่แล้ว ให้เขียนทับแล้ว Save (Update)
	config.MaxCredit = req.MaxCredit
	config.MaxOverdueDays = req.MaxOverdueDays
	config.MaxExtraDiscountRate = req.MaxExtraDiscountRate
	config.SupervisedPin = req.SupervisedPin

	return s.repo.UpdateStoreConfig(config)
}