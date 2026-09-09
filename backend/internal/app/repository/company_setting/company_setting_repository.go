package company_setting

import (
	"backend/internal/app/entity"
	"context"
	"errors"
	"strings"

	"gorm.io/gorm"
)

type CompanySettingRepository interface {
	GetCompanySetting(ctx context.Context) (*entity.CompanySetting, error)
	UpdateCompanySetting(ctx context.Context, setting *entity.CompanySetting) (*entity.CompanySetting, error)
}

type companySettingRepository struct {
	db *gorm.DB
}

func NewCompanySettingRepository(db *gorm.DB) CompanySettingRepository {
	return &companySettingRepository{db: db}
}

func (r *companySettingRepository) GetCompanySetting(ctx context.Context) (*entity.CompanySetting, error) {
	var setting entity.CompanySetting
	err := r.db.WithContext(ctx).First(&setting).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			defaultSetting := entity.CompanySetting{
				CompanyName: "",
				TaxIDNumber: "",
				Address:     "",
				PhoneNumber: "",
				Email:       "",
				LogoURL:     "",
			}
			if createErr := r.db.WithContext(ctx).Create(&defaultSetting).Error; createErr != nil {
				return nil, createErr
			}
			return &defaultSetting, nil
		}
		return nil, err
	}
	return &setting, nil
}

func (r *companySettingRepository) UpdateCompanySetting(ctx context.Context, setting *entity.CompanySetting) (*entity.CompanySetting, error) {
	var existing entity.CompanySetting
	err := r.db.WithContext(ctx).First(&existing).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if createErr := r.db.WithContext(ctx).Create(setting).Error; createErr != nil {
				return nil, createErr
			}
			return setting, nil
		}
		return nil, err
	}

	existing.CompanyName = setting.CompanyName
	existing.TaxIDNumber = setting.TaxIDNumber
	existing.Address = setting.Address
	existing.PhoneNumber = setting.PhoneNumber
	existing.Email = setting.Email
	existing.LogoURL = setting.LogoURL

	if setting.PromptPayType != "" {
		existing.PromptPayType = setting.PromptPayType
	}
	if setting.PromptPayName != "" {
		existing.PromptPayName = setting.PromptPayName
	}
	if setting.PromptPayNumber != "" && !strings.Contains(setting.PromptPayNumber, "*") {
		existing.PromptPayNumber = setting.PromptPayNumber
	}

	existing.BankName = setting.BankName
	existing.BankAccountName = setting.BankAccountName
	if setting.BankAccountNumber != "" && !strings.Contains(setting.BankAccountNumber, "*") {
		existing.BankAccountNumber = setting.BankAccountNumber
	}

	if err := r.db.WithContext(ctx).Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}
