package wms

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"time"

	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"

	"gorm.io/gorm"
)

type ProductService interface {
	CreateProduct(req *wmsDto.ProductRequestDTO) error
	GetProductByID(id uint) (*wmsDto.ProductListResponseDTO, error)
	UpdateProduct(id uint, req *wmsDto.ProductRequestDTO) error
	DeleteProduct(id uint) error
	ListProducts() ([]wmsDto.ProductListResponseDTO, error)
	ListBrands() ([]entity.Brand, error)
	CreateBrand(req *wmsDto.BrandRequestDTO) (*entity.Brand, error)
	UpdateBrand(id uint, req *wmsDto.BrandRequestDTO) error
	DeleteBrand(id uint) error

	CreateModel(req *wmsDto.ModelRequestDTO) (*entity.Models, error)
	UpdateModel(id uint, req *wmsDto.ModelRequestDTO) error
	DeleteModel(id uint) error


}

type productService struct {
	repo wmsRepo.ProductRepository
}

func NewProductService(repo wmsRepo.ProductRepository) ProductService {
	return &productService{repo: repo}
}

func (s *productService) CreateProduct(req *wmsDto.ProductRequestDTO) error {
	product := req.ToEntity()
	for _, id := range req.ModelIDs {
		product.Models = append(product.Models, entity.Models{
			Model: gorm.Model{ID: id},
		})
	}
	if product.Barcode == "" {
		product.Barcode = product.Product_Code
	}
	err := s.repo.CreateProduct(&product)
	if err != nil {
		return err
	}
	triggerBarcodeGen([]uint{product.ID})
	return nil
}

func (s *productService) GetProductByID(id uint) (*wmsDto.ProductListResponseDTO, error) {
	product, err := s.repo.GetProductByID(id)
	if err != nil {
		return nil, err
	}
	var dto wmsDto.ProductListResponseDTO
	dto.FromEntity(*product)
	return &dto, nil
}

func (s *productService) UpdateProduct(id uint, req *wmsDto.ProductRequestDTO) error {
	product := req.ToEntity()
	product.ID = id
	for _, modelId := range req.ModelIDs {
		product.Models = append(product.Models, entity.Models{
			Model: gorm.Model{ID: modelId},
		})
	}
	if product.Barcode == "" {
		product.Barcode = product.Product_Code
	}
	err := s.repo.UpdateProduct(&product)
	if err != nil {
		return err
	}
	triggerBarcodeGen([]uint{id})
	return nil
}

func (s *productService) DeleteProduct(id uint) error {
	return s.repo.DeleteProduct(id)
}

func (s *productService) ListProducts() ([]wmsDto.ProductListResponseDTO, error) {
	products, err := s.repo.ListProducts()
	if err != nil {
		return nil, err
	}
	result := make([]wmsDto.ProductListResponseDTO, len(products))
	for i, p := range products {
		result[i].FromEntity(p)
	}
	return result, nil
}

func (s *productService) ListBrands() ([]entity.Brand, error) {
	return s.repo.ListBrands()
}



func (s *productService) CreateBrand(req *wmsDto.BrandRequestDTO) (*entity.Brand, error) {
	brand := &entity.Brand{
		Brand_Name: req.BrandName,
	}
	err := s.repo.CreateBrand(brand)
	return brand, err
}

func (s *productService) UpdateBrand(id uint, req *wmsDto.BrandRequestDTO) error {
	brand := &entity.Brand{
		Model:      gorm.Model{ID: id},
		Brand_Name: req.BrandName,
	}
	return s.repo.UpdateBrand(brand)
}

func (s *productService) DeleteBrand(id uint) error {
	return s.repo.DeleteBrand(id)
}

func (s *productService) CreateModel(req *wmsDto.ModelRequestDTO) (*entity.Models, error) {
	model := &entity.Models{
		Model_Name: req.ModelName,
		BrandID:    req.BrandID,
	}
	err := s.repo.CreateModel(model)
	return model, err
}

func (s *productService) UpdateModel(id uint, req *wmsDto.ModelRequestDTO) error {
	model := &entity.Models{
		Model:      gorm.Model{ID: id},
		Model_Name: req.ModelName,
		BrandID:    req.BrandID,
	}
	return s.repo.UpdateModel(model)
}

func (s *productService) DeleteModel(id uint) error {
	return s.repo.DeleteModel(id)
}

func triggerBarcodeGen(ids []uint) {
	if len(ids) == 0 {
		return
	}
	go func(productIDs []uint) {
		payload := map[string]interface{}{
			"product_ids": productIDs,
		}
		jsonPayload, errPayload := json.Marshal(payload)
		if errPayload != nil {
			log.Printf("[WMS] Error marshaling product IDs payload: %v\n", errPayload)
			return
		}
		client := http.Client{
			Timeout: 15 * time.Second,
		}
		fastAPIURL := "http://127.0.0.1:8000/api/products/generate-codes"
		resp, errReq := client.Post(fastAPIURL, "application/json", bytes.NewBuffer(jsonPayload))
		if errReq != nil {
			log.Printf("[WMS] Error calling FastAPI to generate product codes: %v\n", errReq)
			return
		}
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			log.Printf("[WMS] FastAPI returned non-OK status: %s\n", resp.Status)
		}
	}(ids)
}
