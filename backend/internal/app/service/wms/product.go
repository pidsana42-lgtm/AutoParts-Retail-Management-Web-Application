package wms

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	wmsDto "backend/internal/app/dto/wms"
	"backend/internal/app/entity"
	wmsRepo "backend/internal/app/repository/wms"
	"backend/internal/pkg/storage"

	"gorm.io/gorm"
)

type ProductService interface {
	CreateProduct(req *wmsDto.ProductRequestDTO) (*wmsDto.ProductListResponseDTO, error)
	GetProductByID(id uint) (*wmsDto.ProductListResponseDTO, error)
	UpdateProduct(id uint, req *wmsDto.ProductRequestDTO) error
	DeleteProduct(id uint) error
	UploadProductImage(productID uint, originalFilename, mimeType string, data []byte) (*wmsDto.ProductImageResponseDTO, error)
	ListProducts() ([]wmsDto.ProductListResponseDTO, error)
	ListBrands() ([]entity.Brand, error)
	CreateBrand(req *wmsDto.BrandRequestDTO) (*entity.Brand, error)
	UpdateBrand(id uint, req *wmsDto.BrandRequestDTO) error
	DeleteBrand(id uint) error

	CreateModel(req *wmsDto.ModelRequestDTO) (*entity.Models, error)
	UpdateModel(id uint, req *wmsDto.ModelRequestDTO) error
	DeleteModel(id uint) error

	// ReceiveStock: รับสินค้าเข้าเพิ่มให้สินค้าที่มีอยู่แล้วในระบบ (หน้า "เพิ่มข้อมูลสินค้า" โหมด "สินค้าที่มีอยู่แล้ว")
	ReceiveStock(id uint, req *wmsDto.ReceiveStockRequestDTO) (*wmsDto.ProductListResponseDTO, error)
}

type productService struct {
	repo wmsRepo.ProductRepository
}

func NewProductService(repo wmsRepo.ProductRepository) ProductService {
	return &productService{repo: repo}
}

func (s *productService) CreateProduct(req *wmsDto.ProductRequestDTO) (*wmsDto.ProductListResponseDTO, error) {
	if err := validateSupplierQuantities(req.Suppliers, req.Quantity); err != nil {
		return nil, err
	}
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
		return nil, err
	}
	if err := s.repo.ReplaceProductSuppliers(product.ID, buildInventories(req.Suppliers)); err != nil {
		return nil, err
	}
	triggerBarcodeGen([]uint{product.ID})

	created, err := s.GetProductByID(product.ID)
	if err != nil {
		return nil, err
	}
	return created, nil
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
	if err := validateSupplierQuantities(req.Suppliers, req.Quantity); err != nil {
		return err
	}
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
	if err := s.repo.ReplaceProductSuppliers(id, buildInventories(req.Suppliers)); err != nil {
		return err
	}
	triggerBarcodeGen([]uint{id})
	return nil
}

// validateSupplierQuantities: ยอดรวมจำนวนที่รับมาจาก Supplier แต่ละเจ้า ต้องไม่เกินจำนวนสินค้าทั้งหมดที่มีจริง
// (กันกรอกจำนวนต่อเจ้ารวมกันแล้วเกินยอดคงเหลือจริงของสินค้า)
func validateSupplierQuantities(suppliers []wmsDto.ProductSupplierInput, totalQuantity int) error {
	sum := 0
	for _, sup := range suppliers {
		sum += sup.Quantity
	}
	if sum > totalQuantity {
		return fmt.Errorf("จำนวนสินค้าที่รับมาจาก Supplier รวมกัน (%d) เกินจำนวนสินค้าทั้งหมด (%d)", sum, totalQuantity)
	}
	return nil
}

// buildInventories: แปลงรายชื่อ Supplier+จำนวนที่ฟอร์มส่งมา ให้เป็นแถว Inventory พร้อมบันทึก
func buildInventories(suppliers []wmsDto.ProductSupplierInput) []entity.Inventory {
	inventories := make([]entity.Inventory, 0, len(suppliers))
	for _, sup := range suppliers {
		inventories = append(inventories, entity.Inventory{
			SupplierID:            sup.SupplierID,
			Inventory_Quantity:    sup.Quantity,
			Last_Updated_DateTime: time.Now(),
		})
	}
	return inventories
}

func (s *productService) DeleteProduct(id uint) error {
	return s.repo.DeleteProduct(id)
}

// ReceiveStock: รับสินค้าเข้าเพิ่มให้สินค้าที่มีอยู่แล้ว — บวกจำนวนรวม + จำนวนต่อ Supplier เข้ากับยอดเดิม (ไม่แทนที่)
func (s *productService) ReceiveStock(id uint, req *wmsDto.ReceiveStockRequestDTO) (*wmsDto.ProductListResponseDTO, error) {
	if err := validateSupplierQuantities(req.Suppliers, req.Quantity); err != nil {
		return nil, err
	}
	if err := s.repo.ReceiveStock(id, req.Quantity, buildInventories(req.Suppliers)); err != nil {
		return nil, err
	}
	return s.GetProductByID(id)
}

func (s *productService) UploadProductImage(productID uint, originalFilename, mimeType string, data []byte) (*wmsDto.ProductImageResponseDTO, error) {
	if _, err := s.repo.GetProductByID(productID); err != nil {
		return nil, fmt.Errorf("product not found: %w", err)
	}

	safeName := sanitizeStorageFilename(originalFilename)
	storageFilename := fmt.Sprintf("product-images/%d/%d_%s", productID, time.Now().UnixNano(), safeName)
	publicURL, err := storage.UploadProductImage(storageFilename, mimeType, data)
	if err != nil {
		return nil, err
	}

	image := entity.ProductImage{
		ProductID: productID,
		Image_URL: publicURL,
	}
	if err := s.repo.CreateProductImage(&image); err != nil {
		return nil, err
	}

	return &wmsDto.ProductImageResponseDTO{
		ID:        image.ID,
		ProductID: productID,
		ImageURL:  publicURL,
	}, nil
}

func sanitizeStorageFilename(name string) string {
	ext := strings.ToLower(filepath.Ext(name))
	base := strings.TrimSuffix(filepath.Base(name), ext)
	base = regexp.MustCompile(`[^a-zA-Z0-9_-]`).ReplaceAllString(base, "_")
	base = strings.Trim(base, "_")
	if base == "" {
		base = "product"
	}
	if ext == "" {
		ext = ".jpg"
	}
	return base + ext
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
		fastAPIURL := os.Getenv("FASTAPI_GENERATE_CODES_URL")
		if fastAPIURL == "" {
			fastAPIURL = "http://127.0.0.1:8000/api/products/generate-codes"
		}
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
