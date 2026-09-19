package company_setting

import (
	dto "backend/internal/app/dto/company_setting"
	"backend/internal/app/entity"
	repo "backend/internal/app/repository/company_setting"
	"backend/internal/pkg/crypto"
	"context"
)

type CompanySettingService interface {
	GetCompanySetting(ctx context.Context) (*dto.CompanySettingResponse, error)
	UpdateCompanySetting(ctx context.Context, req *dto.CompanySettingReq) (*dto.CompanySettingResponse, error)
	RevealPaymentSetting(ctx context.Context) (*dto.PaymentSettingRevealResponse, error)
}

type companySettingService struct {
	repo repo.CompanySettingRepository
}

func NewCompanySettingService(repo repo.CompanySettingRepository) CompanySettingService {
	return &companySettingService{repo: repo}
}

func (s *companySettingService) GetCompanySetting(ctx context.Context) (*dto.CompanySettingResponse, error) {
	data, err := s.repo.GetCompanySetting(ctx)
	if err != nil {
		return nil, err
	}
	return &dto.CompanySettingResponse{
		ID:                    data.ID,
		CompanyName:           data.CompanyName,
		TaxIDNumber:           data.TaxIDNumber,
		Address:               data.Address,
		PhoneNumber:           data.PhoneNumber,
		Email:                 data.Email,
		LogoURL:               data.LogoURL,
		PromptPayType:         data.PromptPayType,
		PromptPayNumberMasked: crypto.MaskSensitiveNumber(data.PromptPayNumber),
		PromptPayName:         data.PromptPayName,
		HasPromptPay:          data.PromptPayNumber != "",
		BankName:                data.BankName,
		BankAccountNumber:       data.BankAccountNumber,
		BankAccountNumberMasked: crypto.MaskSensitiveNumber(data.BankAccountNumber),
		BankAccountName:         data.BankAccountName,
		HasBankAccount:          data.BankAccountNumber != "",
	}, nil
}

func (s *companySettingService) UpdateCompanySetting(ctx context.Context, req *dto.CompanySettingReq) (*dto.CompanySettingResponse, error) {
	setting := &entity.CompanySetting{
		CompanyName:       req.CompanyName,
		TaxIDNumber:       req.TaxIDNumber,
		Address:           req.Address,
		PhoneNumber:       req.PhoneNumber,
		Email:             req.Email,
		LogoURL:           req.LogoURL,
		PromptPayType:     req.PromptPayType,
		PromptPayNumber:   req.PromptPayNumber,
		PromptPayName:     req.PromptPayName,
		BankName:          req.BankName,
		BankAccountNumber: req.BankAccountNumber,
		BankAccountName:   req.BankAccountName,
	}

	updated, err := s.repo.UpdateCompanySetting(ctx, setting)
	if err != nil {
		return nil, err
	}

	return &dto.CompanySettingResponse{
		ID:                    updated.ID,
		CompanyName:           updated.CompanyName,
		TaxIDNumber:           updated.TaxIDNumber,
		Address:               updated.Address,
		PhoneNumber:           updated.PhoneNumber,
		Email:                 updated.Email,
		LogoURL:               updated.LogoURL,
		PromptPayType:         updated.PromptPayType,
		PromptPayNumberMasked: crypto.MaskSensitiveNumber(updated.PromptPayNumber),
		PromptPayName:         updated.PromptPayName,
		HasPromptPay:          updated.PromptPayNumber != "",
		BankName:                updated.BankName,
		BankAccountNumber:       updated.BankAccountNumber,
		BankAccountNumberMasked: crypto.MaskSensitiveNumber(updated.BankAccountNumber),
		BankAccountName:         updated.BankAccountName,
		HasBankAccount:          updated.BankAccountNumber != "",
	}, nil
}

func (s *companySettingService) RevealPaymentSetting(ctx context.Context) (*dto.PaymentSettingRevealResponse, error) {
	data, err := s.repo.GetCompanySetting(ctx)
	if err != nil {
		return nil, err
	}

	return &dto.PaymentSettingRevealResponse{
		PromptPayNumber:   data.PromptPayNumber,
		PromptPayType:     data.PromptPayType,
		PromptPayName:     data.PromptPayName,
		BankAccountNumber: data.BankAccountNumber,
		BankName:          data.BankName,
		BankAccountName:   data.BankAccountName,
	}, nil
}

