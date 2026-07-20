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
	ListGrades() ([]entity.Grade, error)
}

type productService struct {
	repo wmsRepo.ProductRepository
}

func NewProductService(repo wmsRepo.ProductRepository) ProductService {
	return &productService{repo: repo}
}

func (s *productService) CreateProduct(req *wmsDto.ProductRequestDTO) error {
	product := req.ToEntity()
	for _, id := range req.BrandIDs {
		product.Brands = append(product.Brands, entity.Brand{
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
	for _, brandId := range req.BrandIDs {
		product.Brands = append(product.Brands, entity.Brand{
			Model: gorm.Model{ID: brandId},
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

func (s *productService) ListGrades() ([]entity.Grade, error) {
	return s.repo.ListGrades()
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
