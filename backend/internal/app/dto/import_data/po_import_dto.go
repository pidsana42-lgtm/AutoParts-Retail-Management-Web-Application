package import_data

import (
	"backend/internal/app/entity"
)

type PurchaseOrderItemImportDTO struct {
	ID                 uint    `json:"id"`
	POID               uint    `json:"po_id"`
	ProductID          uint    `json:"product_id"`
	CompanyProductCode string  `json:"company_product_code"`
	CompanyProductName string  `json:"company_product_name"`
	OrderQuantity      float64 `json:"order_quantity"`
	Unit               string  `json:"unit"`
	PricePerUnit       float64 `json:"price_per_unit"`
	NetAmount          float64 `json:"net_amount"`
}

type PurchaseOrderImportDTO struct {
	ID           uint                         `json:"id"`
	OrderNumber  string                       `json:"order_number"`
	SupplierID   uint                         `json:"supplier_id"`
	SupplierName string                       `json:"supplier_name"`
	TotalAmount  float64                      `json:"total_amount"`
	Status       string                       `json:"status"`
	CreatedAt    string                       `json:"created_at"`
	Items        []PurchaseOrderItemImportDTO `json:"items,omitempty"`
}

func ToPurchaseOrderImportDTO(po *entity.PO) PurchaseOrderImportDTO {
	supplierName := ""
	if po.Supplier.SupplierName != "" {
		supplierName = po.Supplier.SupplierName
	}

	itemsDTO := make([]PurchaseOrderItemImportDTO, 0, len(po.PO_Items))
	for _, item := range po.PO_Items {
		itemsDTO = append(itemsDTO, PurchaseOrderItemImportDTO{
			ID:                 item.ID,
			POID:               item.POID,
			ProductID:          item.ProductID,
			CompanyProductCode: item.Supply_product_code_snapshot,
			CompanyProductName: item.Product_name_snapshot,
			OrderQuantity:      item.Quantity,
			Unit:               item.Unit,
			PricePerUnit:       item.UnitPrice,
			NetAmount:          item.SubTotal,
		})
	}

	return PurchaseOrderImportDTO{
		ID:           po.ID,
		OrderNumber:  po.PO_number,
		SupplierID:   po.SupplierID,
		SupplierName: supplierName,
		TotalAmount:  po.Total_amount,
		Status:       string(po.Status),
		CreatedAt:    po.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Items:        itemsDTO,
	}
}
