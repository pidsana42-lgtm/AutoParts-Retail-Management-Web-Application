package company_setting

import (
	dto "backend/internal/app/dto/company_setting"
	"backend/internal/app/entity"
	repo "backend/internal/app/repository/company_setting"
	"context"
)

type CompanySettingService interface {
	GetCompanySetting(ctx context.Context) (*dto.CompanySettingResponse, error)
	UpdateCompanySetting(ctx context.Context, req *dto.CompanySettingReq) (*dto.CompanySettingResponse, error)
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
		ID:          data.ID,
		CompanyName: data.CompanyName,
		TaxIDNumber: data.TaxIDNumber,
		Address:     data.Address,
		PhoneNumber: data.PhoneNumber,
		Email:       data.Email,
		LogoURL:     data.LogoURL,
	}, nil
}

func (s *companySettingService) UpdateCompanySetting(ctx context.Context, req *dto.CompanySettingReq) (*dto.CompanySettingResponse, error) {
	setting := &entity.CompanySetting{
		CompanyName: req.CompanyName,
		TaxIDNumber: req.TaxIDNumber,
		Address:     req.Address,
		PhoneNumber: req.PhoneNumber,
		Email:       req.Email,
		LogoURL:     req.LogoURL,
	}

	updated, err := s.repo.UpdateCompanySetting(ctx, setting)
	if err != nil {
		return nil, err
	}

	return &dto.CompanySettingResponse{
		ID:          updated.ID,
		CompanyName: updated.CompanyName,
		TaxIDNumber: updated.TaxIDNumber,
		Address:     updated.Address,
		PhoneNumber: updated.PhoneNumber,
		Email:       updated.Email,
		LogoURL:     updated.LogoURL,
	}, nil
}
