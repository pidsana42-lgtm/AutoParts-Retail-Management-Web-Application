package pos

import (
	storeconfigDto "backend/internal/app/dto/pos"
	storeconfigRepo "backend/internal/app/repository/pos"
)

type StoreConfigService interface {
	GetStoreConfig() (*storeconfigDto.StoreConfigResponse, error)
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
		return nil, err
	}
	return storeconfigDto.ToStoreConfigResponse(config), nil
}

func (s *storeConfigService) UpdateStoreConfig(req *storeconfigDto.StoreConfigRequest) error {
	//ไปสอยข้อมูลแถวที่ 1 (ที่มีอยู่แล้วในเบส) ขึ้นมาเก็บไว้ในตัวแปร config ก่อน
	config, err := s.repo.GetStoreConfig()
	if err != nil {
		return err
	}
	//เขียนทับค่าการตั้งค่าร้านค้าด้วยค่าที่ได้รับจากrequest Match
	config.MaxCredit = req.MaxCredit
	config.MaxOverdueDays = req.MaxOverdueDays
	//config.MaxItemDiscountRate = req.MaxItemDiscountRate
	config.MaxExtraDiscountRate = req.MaxExtraDiscountRate
	config.SupervisedPin = req.SupervisedPin

	//save config ที่ถูกแก้ไขแล้วกลับไปที่ฐานข้อมูล
	return s.repo.UpdateStoreConfig(config)
}