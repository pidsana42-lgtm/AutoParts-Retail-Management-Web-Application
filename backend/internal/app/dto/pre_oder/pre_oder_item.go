package pre_order

import (
	"strings"
	"time"

	"backend/internal/app/entity"
)

type CreatePreOrderItemDTO struct {
	// Nested items receive their parent ID when the order is saved.
	// The standalone item endpoint checks that a parent ID is supplied.
	PreOrderID       uint    `json:"pre_order_id"`
	ProductID        uint    `json:"product_id"`
	ProductName      string  `json:"product_name"`
	ProductCode      string  `json:"product_code"`
	SupplierPartCode string  `json:"supplier_part_code"`
	SupplierName     string  `json:"supplier_name"`
	Quantity         int     `json:"quantity" binding:"gt=0"`
	UnitPrice        float64 `json:"unit_price" binding:"gte=0"`
}

type UpdatePreOrderItemDTO struct {
	PreOrderID       *uint    `json:"pre_order_id,omitempty"`
	ProductID        *uint    `json:"product_id,omitempty"`
	ProductName      *string  `json:"product_name,omitempty"`
	ProductCode      *string  `json:"product_code,omitempty"`
	SupplierPartCode *string  `json:"supplier_part_code,omitempty"`
	SupplierName     *string  `json:"supplier_name,omitempty"`
	Quantity         *int     `json:"quantity,omitempty"`
	UnitPrice        *float64 `json:"unit_price,omitempty"`
}

type PreOrderItemResponseDTO struct {
	ReceivedQuantity int       `json:"received_quantity"`
	ID               uint      `json:"id"`
	PreOrderID       uint      `json:"pre_order_id"`
	ProductID        uint      `json:"product_id"`
	ProductName      string    `json:"product_name,omitempty"`
	ProductCode      string    `json:"product_code,omitempty"`
	SupplierPartCode string    `json:"supplier_part_code,omitempty"`
	SupplierName     string    `json:"supplier_name,omitempty"`
	Quantity         int       `json:"quantity"`
	UnitPrice        float64   `json:"unit_price"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

func (d *CreatePreOrderItemDTO) ToEntity() entity.PreOrderItem {
	var prodID *uint
	if d.ProductID > 0 {
		prodID = &d.ProductID
	}
	return entity.PreOrderItem{
		PreOrderID:          d.PreOrderID,
		ProductID:           prodID,
		ProductNameSnapshot: strings.TrimSpace(d.ProductName),
		ProductCodeSnapshot: strings.TrimSpace(d.ProductCode),
		SupplierPartCode:    strings.TrimSpace(d.SupplierPartCode),
		SupplierName:        strings.TrimSpace(d.SupplierName),
		Quantity:            d.Quantity,
		UnitPrice:           d.UnitPrice,
	}
}

func (d *UpdatePreOrderItemDTO) ToEntity(existing entity.PreOrderItem) entity.PreOrderItem {
	if d.PreOrderID != nil {
		existing.PreOrderID = *d.PreOrderID
	}
	if d.ProductID != nil {
		if *d.ProductID > 0 {
			existing.ProductID = d.ProductID
		} else {
			existing.ProductID = nil
		}
	}
	if d.ProductName != nil {
		existing.ProductNameSnapshot = strings.TrimSpace(*d.ProductName)
	}
	if d.ProductCode != nil {
		existing.ProductCodeSnapshot = strings.TrimSpace(*d.ProductCode)
	}
	if d.SupplierPartCode != nil {
		existing.SupplierPartCode = strings.TrimSpace(*d.SupplierPartCode)
	}
	if d.SupplierName != nil {
		existing.SupplierName = strings.TrimSpace(*d.SupplierName)
	}
	if d.Quantity != nil {
		existing.Quantity = *d.Quantity
	}
	if d.UnitPrice != nil {
		existing.UnitPrice = *d.UnitPrice
	}
	return existing
}

func ToPreOrderItemResponseDTO(m *entity.PreOrderItem) PreOrderItemResponseDTO {
	prodName := strings.TrimSpace(m.ProductNameSnapshot)
	prodCode := strings.TrimSpace(m.ProductCodeSnapshot)
	supplierPartCode := strings.TrimSpace(m.SupplierPartCode)
	supplierName := strings.TrimSpace(m.SupplierName)
	var productID uint
	if m.ProductID != nil && *m.ProductID > 0 {
		productID = *m.ProductID
		if m.Product != nil {
			if prodName == "" {
				prodName = m.Product.Product_Name
			}
			if prodCode == "" {
				prodCode = m.Product.Product_Code
			}
			// CompanyProductCode ย้ายไปอยู่ที่ Inventory แล้ว (ผูกกับ Supplier แต่ละเจ้า ไม่ใช่ Product โดยตรง) — วนหาจาก Inventory แทน
			for _, inventory := range m.Product.Inventories {
				if supplierPartCode == "" && strings.TrimSpace(inventory.CompanyProductCode) != "" {
					supplierPartCode = strings.TrimSpace(inventory.CompanyProductCode)
				}
				if supplierPartCode == "" && strings.TrimSpace(inventory.Variant_Code) != "" {
					supplierPartCode = strings.TrimSpace(inventory.Variant_Code)
				}
				if supplierName == "" && inventory.Supplier != nil {
					supplierName = strings.TrimSpace(inventory.Supplier.SupplierName)
				}
				if supplierPartCode != "" && supplierName != "" {
					break
				}
			}

			if supplierPartCode == "" {
				supplierPartCode = strings.TrimSpace(m.Product.Part_Number)
			}
		}
	}

	return PreOrderItemResponseDTO{
		ReceivedQuantity: m.ReceivedQuantity,
		ID:               m.ID,
		PreOrderID:       m.PreOrderID,
		ProductID:        productID,
		ProductName:      prodName,
		ProductCode:      prodCode,
		SupplierPartCode: supplierPartCode,
		SupplierName:     supplierName,
		Quantity:         m.Quantity,
		UnitPrice:        m.UnitPrice,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}

// แยก Struct ใหม่มาใช้เฉพาะหน้าเลือก PreOrder เข้า PO
type PreOrderItemForPODTO struct {
	ID               uint      `json:"id"`
	PreOrderID       uint      `json:"pre_order_id"`
	ProductID        uint      `json:"product_id"`
	ProductCode      string    `json:"product_code"`
	ProductName      string    `json:"product_name"`
	SupplierPartCode string    `json:"supplier_part_code,omitempty"`
	SupplierName     string    `json:"supplier_name,omitempty"`
	Unit             string    `json:"unit"`
	Quantity         int       `json:"quantity"`
	UnitPrice        float64   `json:"unit_price"`
	Status           string    `json:"status"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// ฟังก์ชัน Map สำหรับ DTO ตัวใหม่
func ToPreOrderItemForPODTO(m *entity.PreOrderItem) PreOrderItemForPODTO {
	pCode := strings.TrimSpace(m.ProductCodeSnapshot)
	pName := strings.TrimSpace(m.ProductNameSnapshot)
	pSupplierCode := strings.TrimSpace(m.SupplierPartCode)
	pSupplierName := strings.TrimSpace(m.SupplierName)
	var pUnit string
	var productID uint
	if m.ProductID != nil && *m.ProductID > 0 {
		productID = *m.ProductID
		if m.Product != nil {
			if pCode == "" {
				pCode = m.Product.Product_Code
			}
			if pName == "" {
				pName = m.Product.Product_Name
			}
			// CompanyProductCode ย้ายไปอยู่ที่ Inventory แล้ว (ผูกกับ Supplier แต่ละเจ้า ไม่ใช่ Product โดยตรง) — วนหาจาก Inventory แทน
			for _, inventory := range m.Product.Inventories {
				if pSupplierCode == "" && strings.TrimSpace(inventory.CompanyProductCode) != "" {
					pSupplierCode = strings.TrimSpace(inventory.CompanyProductCode)
				}
				if pSupplierCode == "" && strings.TrimSpace(inventory.Variant_Code) != "" {
					pSupplierCode = strings.TrimSpace(inventory.Variant_Code)
				}
				if pSupplierName == "" && inventory.Supplier != nil {
					pSupplierName = strings.TrimSpace(inventory.Supplier.SupplierName)
				}
				if pSupplierCode != "" && pSupplierName != "" {
					break
				}
			}
			if pSupplierCode == "" {
				pSupplierCode = strings.TrimSpace(m.Product.Part_Number)
			}
			if m.Product.Unit != nil {
				pUnit = m.Product.Unit.Unit_Name
			}
		}
	}

	return PreOrderItemForPODTO{
		ID:               m.ID,
		PreOrderID:       m.PreOrderID,
		ProductID:        productID,
		ProductCode:      pCode,
		ProductName:      pName,
		SupplierPartCode: pSupplierCode,
		SupplierName:     pSupplierName,
		Unit:             pUnit,
		Quantity:         m.Quantity,
		UnitPrice:        m.UnitPrice,
		Status:           m.Status,
		CreatedAt:        m.CreatedAt,
		UpdatedAt:        m.UpdatedAt,
	}
}
