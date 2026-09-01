package wms

import (
	"backend/internal/app/entity"
	wmsDto  "backend/internal/app/dto/wms"
	wmsRepo "backend/internal/app/repository/wms"
)

type SupplierService interface {
	Create(req *wmsDto.SupplierRequestDTO) (*wmsDto.SupplierResponseDTO, error)
	GetByID(id uint) (*wmsDto.SupplierResponseDTO, error)
	Update(id uint, req *wmsDto.SupplierRequestDTO) error
	Delete(id uint) error
	List() ([]wmsDto.SupplierResponseDTO, error)
}

type supplierService struct {
	repo wmsRepo.SupplierRepository
}

func NewSupplierService(repo wmsRepo.SupplierRepository) SupplierService {
	return &supplierService{repo: repo}
}

func (s *supplierService) Create(req *wmsDto.SupplierRequestDTO) (*wmsDto.SupplierResponseDTO, error) {
	supplier := entity.Supplier{
		SupplierName:      req.SupplierName,
		SupplierAddress:   req.SupplierAddress,
		ContactLineSale:   req.ContactLineSale,
		PhoneNumberSale:   req.PhoneNumberSale,
		EmailSale:         req.EmailSale,
		ContactLineSale2:  req.ContactLineSale2,
		PhoneNumberSale2:  req.PhoneNumberSale2,
		EmailSale2:        req.EmailSale2,
		BankAccountNumber: req.BankAccountNumber,
		ShortSupplierName: req.ShortSupplierName,
	}
	if err := s.repo.Create(&supplier); err != nil {
		return nil, err
	}
	// คืนข้อมูลที่เพิ่งสร้างกลับไปพร้อม ID เลย เผื่อฝั่ง frontend ต้องเลือกใช้ Supplier ที่เพิ่งเพิ่มทันที
	// (เช่น เพิ่มบริษัทใหม่จากฟอร์มเพิ่มสินค้า แล้วอยากให้เลือกบริษัทนั้นในแถวให้เลยโดยไม่ต้องกดเลือกซ้ำ)
	return toSupplierResponse(&supplier), nil
}

func (s *supplierService) GetByID(id uint) (*wmsDto.SupplierResponseDTO, error) {
	sup, err := s.repo.GetByID(id)
	if err != nil {
		return nil, err
	}
	return toSupplierResponse(sup), nil
}

func (s *supplierService) Update(id uint, req *wmsDto.SupplierRequestDTO) error {
	supplier := entity.Supplier{
		SupplierName:      req.SupplierName,
		SupplierAddress:   req.SupplierAddress,
		ContactLineSale:   req.ContactLineSale,
		PhoneNumberSale:   req.PhoneNumberSale,
		EmailSale:         req.EmailSale,
		ContactLineSale2:  req.ContactLineSale2,
		PhoneNumberSale2:  req.PhoneNumberSale2,
		EmailSale2:        req.EmailSale2,
		BankAccountNumber: req.BankAccountNumber,
		ShortSupplierName: req.ShortSupplierName,
	}
	supplier.ID = id
	return s.repo.Update(&supplier)
}

func (s *supplierService) Delete(id uint) error {
	return s.repo.Delete(id)
}

func (s *supplierService) List() ([]wmsDto.SupplierResponseDTO, error) {
	suppliers, err := s.repo.List()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.SupplierResponseDTO, len(suppliers))
	for i, sup := range suppliers {
		result[i] = *toSupplierResponse(&sup)
	}
	return result, nil
}

func toSupplierResponse(s *entity.Supplier) *wmsDto.SupplierResponseDTO {
	return &wmsDto.SupplierResponseDTO{
		ID:                s.ID,
		SupplierName:      s.SupplierName,
		SupplierAddress:   s.SupplierAddress,
		ContactLineSale:   s.ContactLineSale,
		PhoneNumberSale:   s.PhoneNumberSale,
		EmailSale:         s.EmailSale,
		ContactLineSale2:  s.ContactLineSale2,
		PhoneNumberSale2:  s.PhoneNumberSale2,
		EmailSale2:        s.EmailSale2,
		BankAccountNumber: s.BankAccountNumber,
		ShortSupplierName: s.ShortSupplierName,
		CreatedAt:         s.CreatedAt,
		UpdatedAt:         s.UpdatedAt,
	}
}
