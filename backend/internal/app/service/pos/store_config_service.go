package pos

import (
	storeconfigDto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	storeconfigRepo "backend/internal/app/repository/pos"
	"errors"
	"fmt"
	"strings"

	"gorm.io/gorm"
)

type StoreConfigService interface {
	GetStoreConfig() (*storeconfigDto.StoreConfigResponse, error)
	CreateStoreConfig(config *storeconfigDto.StoreConfigRequest, userID uint) error
	UpdateStoreConfig(config *storeconfigDto.StoreConfigRequest, userID uint) error
	GetAuditLogs() ([]storeconfigDto.StoreConfigAuditLogResponse, error)
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

func (s *storeConfigService) recordAuditLog(req *storeconfigDto.StoreConfigRequest, userID uint) {
	userName := "เจ้าของร้าน"
	var userPtr *uint
	if userID > 0 {
		userPtr = &userID
		if user, err := s.repo.GetUserByID(userID); err == nil && user != nil {
			fullName := strings.TrimSpace(user.FirstName + " " + user.LastName)
			if fullName != "" {
				userName = fullName
			} else if user.Username != "" {
				userName = user.Username
			}
		}
	}

	details := fmt.Sprintf("ส่วนลดสูงสุด: %.0f%%, วงเงินเครดิต: ฿%.2f, ระยะเวลาค้างชำระ: %d วัน",
		req.MaxExtraDiscountRate,
		req.MaxCredit,
		req.MaxOverdueDays,
	)

	log := &entity.StoreConfigAuditLog{
		Action:    "แก้ไขการตั้งค่านโยบายการเงินและเครดิต",
		Details:   details,
		ChangedBy: userName,
		UserID:    userPtr,
	}
	_ = s.repo.CreateAuditLog(log)
}

func (s *storeConfigService) CreateStoreConfig(req *storeconfigDto.StoreConfigRequest, userID uint) error {
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
		if err := s.repo.UpdateStoreConfig(config); err != nil {
			return err
		}
		s.recordAuditLog(req, userID)
		return nil
	}

	// ถ้ายังไม่มี ให้สร้างใหม่
	newConfig := &entity.StoreConfig{
		MaxCredit:            req.MaxCredit,
		MaxOverdueDays:       req.MaxOverdueDays,
		MaxExtraDiscountRate: req.MaxExtraDiscountRate,
		SupervisedPin:        req.SupervisedPin,
	}
	if err := s.repo.CreateStoreConfig(newConfig); err != nil {
		return err
	}
	s.recordAuditLog(req, userID)
	return nil
}

func (s *storeConfigService) UpdateStoreConfig(req *storeconfigDto.StoreConfigRequest, userID uint) error {
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
			if err := s.repo.CreateStoreConfig(newConfig); err != nil {
				return err
			}
			s.recordAuditLog(req, userID)
			return nil
		}
		return err
	}

	// 3. ถ้ามีอยู่แล้ว ให้เขียนทับแล้ว Save (Update)
	config.MaxCredit = req.MaxCredit
	config.MaxOverdueDays = req.MaxOverdueDays
	config.MaxExtraDiscountRate = req.MaxExtraDiscountRate
	config.SupervisedPin = req.SupervisedPin

	if err := s.repo.UpdateStoreConfig(config); err != nil {
		return err
	}
	s.recordAuditLog(req, userID)
	return nil
}

func (s *storeConfigService) GetAuditLogs() ([]storeconfigDto.StoreConfigAuditLogResponse, error) {
	logs, err := s.repo.GetAuditLogs(50)
	if err != nil {
		return nil, err
	}
	res := make([]storeconfigDto.StoreConfigAuditLogResponse, 0, len(logs))
	for i := range logs {
		res = append(res, *storeconfigDto.ToStoreConfigAuditLogResponse(&logs[i]))
	}
	return res, nil
}