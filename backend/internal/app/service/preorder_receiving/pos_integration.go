// Package preorderreceiving connects customer stock reservations to POS without
// changing the existing POS DTOs, repositories, sale logic, or stock entities.
package preorderreceiving

import (
	"errors"
	"fmt"
	"sort"

	dto "backend/internal/app/dto/pos"
	"backend/internal/app/entity"
	customerRepo "backend/internal/app/repository/customer"
	repo "backend/internal/app/repository/pos"
	pos "backend/internal/app/service/pos"
	"backend/internal/pkg/preorderstock"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type availableProducts struct {
	pos.POSProductService
	db *gorm.DB
}

func WithAvailableStock(db *gorm.DB, original pos.POSProductService) pos.POSProductService {
	return &availableProducts{original, db}
}

func (s *availableProducts) SearchPOSProducts(search string) ([]dto.POSProductResponse, error) {
	products, err := s.POSProductService.SearchPOSProducts(search)
	if err != nil {
		return nil, err
	}
	for i := range products {
		product := &products[i]
		reserved, err := preorderstock.Reserved(s.db, product.ID, nil)
		if err != nil {
			return nil, err
		}
		product.Quantity = max(0, product.Quantity-reserved)
		for j := range product.Suppliers {
			supplier := &product.Suppliers[j]
			reserved, err := preorderstock.Reserved(s.db, product.ID, &supplier.SupplierID)
			if err != nil {
				return nil, err
			}
			supplier.Quantity = max(0, supplier.Quantity-reserved)
		}
	}
	return products, nil
}

type guardedSales struct {
	pos.SaleService
	db *gorm.DB
}

func WithReservationGuard(db *gorm.DB, original pos.SaleService) pos.SaleService {
	return &guardedSales{original, db}
}

// The existing sale service owns commit/rollback. Reuse the transaction that holds
// the reservation check's row locks rather than opening a second transaction.
type saleTransaction struct {
	repo.SaleRepository
	tx *gorm.DB
}

func (r *saleTransaction) BeginTransaction() *gorm.DB { return r.tx }

func scopedSales(tx *gorm.DB) pos.SaleService {
	return pos.NewSaleService(&saleTransaction{repo.NewSaleRepository(tx), tx}, customerRepo.NewCustomerRepository(tx), repo.NewPOSProductRepository(tx))
}

func (s *guardedSales) CreatePOSOrder(req *dto.CreateSaleOrderRequest, userID uint) (*entity.SaleOrder, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()
	if err := checkAvailableStock(tx, req.Items, nil); err != nil {
		return nil, err
	}
	return scopedSales(tx).CreatePOSOrder(req, userID)
}

func (s *guardedSales) UpdatePOSOrder(number string, req *dto.UpdateSaleOrderRequest, userID uint) (*entity.SaleOrder, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}
	defer tx.Rollback()
	var old entity.SaleOrder
	if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).Preload("Items").Where("order_number = ?", number).First(&old).Error; err != nil {
		return nil, err
	}
	if old.Status != "pending" {
		return nil, fmt.Errorf("ไม่สามารถแก้ไขรายการสั่งซื้อที่ทำรายการสำเร็จไปแล้วได้")
	}
	if err := checkAvailableStock(tx, req.Items, old.Items); err != nil {
		return nil, err
	}
	return scopedSales(tx).UpdatePOSOrder(number, req, userID)
}

type supplierStock struct{ productID, supplierID uint }

// Check totals across repeated lines, allowing for units returned by an order edit.
// Sorted product locks stay held through the original service's stock writes and commit.
func checkAvailableStock(tx *gorm.DB, items []dto.SaleOrderItemRequest, returned []entity.SaleOrderItem) error {
	needed := map[uint]int{}
	bySupplier := map[supplierStock]int{}
	for _, item := range items {
		if item.Qty <= 0 {
			return fmt.Errorf("จำนวนขายต้องมากกว่าศูนย์")
		}
		needed[item.ProductID] += item.Qty
		if item.SupplierID != nil {
			bySupplier[supplierStock{item.ProductID, *item.SupplierID}] += item.Qty
		}
	}
	for _, item := range returned {
		needed[item.ProductID] -= item.Qty
		if item.SupplierID != nil {
			bySupplier[supplierStock{item.ProductID, *item.SupplierID}] -= item.Qty
		}
	}
	ids := make([]uint, 0, len(needed))
	for id := range needed {
		ids = append(ids, id)
	}
	sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
	for _, id := range ids {
		var product entity.Product
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&product, id).Error; err != nil {
			return err
		}
		reserved, err := preorderstock.Reserved(tx, id, nil)
		if err != nil {
			return err
		}
		if product.Quantity-needed[id] < reserved {
			return fmt.Errorf("สินค้า %s สต็อกไม่พอขาย (พร้อมขาย %d ชิ้น หลังกันพรีออเดอร์)", product.Product_Name, max(0, product.Quantity-reserved))
		}
	}
	for key, qty := range bySupplier {
		var inventory entity.Inventory
		err := tx.Where("product_id = ? AND supplier_id = ?", key.productID, key.supplierID).First(&inventory).Error
		// Preserve the original POS behavior for products without a supplier inventory.
		if errors.Is(err, gorm.ErrRecordNotFound) {
			continue
		}
		if err != nil {
			return err
		}
		reserved, err := preorderstock.Reserved(tx, key.productID, &key.supplierID)
		if err != nil {
			return err
		}
		if inventory.Inventory_Quantity-qty < reserved {
			return fmt.Errorf("สต็อกสินค้าบริษัทที่เลือกไม่พอขาย หลังกันพรีออเดอร์")
		}
	}
	return nil
}
