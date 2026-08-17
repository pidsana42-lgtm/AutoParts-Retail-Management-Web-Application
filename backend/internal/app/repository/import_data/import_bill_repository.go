package repository

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
	"backend/internal/app/entity"
)

type ImportBillRepository interface {
	CreateBill(bill *entity.Bill) error
	ListBills() ([]entity.Bill, error)
	CreateBillImage(img *entity.BillImage) error
	CreateBillImportJob(job *entity.BillImportJob) error
	GetBillImportJobByID(id uint) (*entity.BillImportJob, error)
	SaveBillImportJob(job *entity.BillImportJob) error
	CreateBillItem(item *entity.BillItem) error
	ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob) error

	GetBillByID(id uint) (*entity.Bill, error)
	UpdateBill(id uint, bill *entity.Bill, items []entity.BillItem) error
	DeleteBill(id uint) error

	FindOrCreateSupplierByName(name string) (uint, error)
	ListPurchaseOrders() ([]entity.PO, error)
	GetPurchaseOrderByID(id uint) (*entity.PO, error)
	UpdateImportProduct(id uint, product *entity.Product, modelIDs []uint) error
}

type billRepository struct {
	db *gorm.DB
}

func NewImportBillRepository(db *gorm.DB) ImportBillRepository {
	return &billRepository{db: db}
}

func (r *billRepository) CreateBill(bill *entity.Bill) error {
	return r.db.Create(bill).Error
}

func (r *billRepository) ListBills() ([]entity.Bill, error) {
	var bills []entity.Bill
	err := r.db.Preload("BillItems").Preload("Supplier").Preload("BillImage").Order("created_at desc").Find(&bills).Error
	return bills, err
}

func (r *billRepository) CreateBillImage(img *entity.BillImage) error {
	return r.db.Create(img).Error
}

func (r *billRepository) CreateBillImportJob(job *entity.BillImportJob) error {
	return r.db.Create(job).Error
}

func (r *billRepository) GetBillImportJobByID(id uint) (*entity.BillImportJob, error) {
	var job entity.BillImportJob
	err := r.db.Preload("Items").First(&job, id).Error
	if err != nil {
		return nil, err
	}
	return &job, nil
}

func (r *billRepository) SaveBillImportJob(job *entity.BillImportJob) error {
	return r.db.Save(job).Error
}

func (r *billRepository) CreateBillItem(item *entity.BillItem) error {
	return r.db.Create(item).Error
}

func (r *billRepository) ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		bill.BillNo = strings.TrimSpace(bill.BillNo)
		if bill.BillNo == "" {
			bill.BillNo = fmt.Sprintf("BILL-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%100000)
		}

		// reverseBillStock subtracts the stock that was added by a previous confirm of this bill.
		// Must be called before deleting the old bill_items, so quantities are still readable.
		reverseBillStock := func(billID uint) error {
			var oldItems []entity.BillItem
			if err := tx.Unscoped().Where("bill_id = ?", billID).Find(&oldItems).Error; err != nil {
				return err
			}
			for _, item := range oldItems {
				if item.ProductID == 0 || item.OrderQuantity <= 0 {
					continue
				}
				if err := tx.Model(&entity.Product{}).
					Where("id = ? AND quantity >= ?", item.ProductID, item.OrderQuantity).
					UpdateColumn("quantity", gorm.Expr("quantity - ?", item.OrderQuantity)).Error; err != nil {
					return err
				}
			}
			return nil
		}

		var existingBill entity.Bill
		errExist := tx.Unscoped().Where("LOWER(TRIM(bill_no)) = LOWER(TRIM(?))", bill.BillNo).First(&existingBill).Error

		if errExist == nil && existingBill.ID > 0 {
			bill.ID = existingBill.ID
			if existingBill.DeletedAt.Valid {
				if err := tx.Unscoped().Model(&existingBill).Update("deleted_at", nil).Error; err != nil {
					return err
				}
			}
			if err := tx.Unscoped().Model(&existingBill).Updates(bill).Error; err != nil {
				return err
			}
			if err := reverseBillStock(existingBill.ID); err != nil {
				return err
			}
			if err := tx.Unscoped().Where("bill_id = ?", existingBill.ID).Delete(&entity.BillItem{}).Error; err != nil {
				return err
			}
		} else {
			targetID := uint(0)
			if bill.ID > 0 {
				targetID = bill.ID
			} else if job != nil && job.ConfirmedBillID != nil && *job.ConfirmedBillID > 0 {
				targetID = *job.ConfirmedBillID
			}

			if targetID > 0 {
				var linkedBill entity.Bill
				if errLinked := tx.Unscoped().Where("id = ?", targetID).First(&linkedBill).Error; errLinked == nil {
					bill.ID = targetID
					if linkedBill.DeletedAt.Valid {
						if err := tx.Unscoped().Model(&linkedBill).Update("deleted_at", nil).Error; err != nil {
							return err
						}
					}
					if err := tx.Unscoped().Model(&linkedBill).Updates(bill).Error; err != nil {
						return err
					}
					if err := reverseBillStock(targetID); err != nil {
						return err
					}
					if err := tx.Unscoped().Where("bill_id = ?", targetID).Delete(&entity.BillItem{}).Error; err != nil {
						return err
					}
				} else {
					if err := tx.Create(bill).Error; err != nil {
						return err
					}
				}
			} else {
				if err := tx.Create(bill).Error; err != nil {
					return err
				}
			}
		}

		for i := range items {
			items[i].BillID = bill.ID

			var prod entity.Product
			var err error

			if items[i].ProductID > 0 {
				err = tx.Where("id = ?", items[i].ProductID).First(&prod).Error
			} else {
				prodName := strings.TrimSpace(items[i].CompanyProductName)
				prodCode := strings.TrimSpace(items[i].CompanyProductCode)
				err = tx.Where("LOWER(TRIM(product_name)) = LOWER(TRIM(?)) OR (LOWER(TRIM(product_code)) = LOWER(TRIM(?)) AND product_code != '')", prodName, prodCode).First(&prod).Error
			}

			if errors.Is(err, gorm.ErrRecordNotFound) {
				catID := uint(1)
				if items[i].CategoryID != nil && *items[i].CategoryID > 0 {
					catID = *items[i].CategoryID
				}
				var subCatID *uint
				if items[i].SubCategoryID != nil && *items[i].SubCategoryID > 0 {
					subCatID = items[i].SubCategoryID
				}

				prodName := strings.TrimSpace(items[i].CompanyProductName)
				if prodName == "" {
					prodName = fmt.Sprintf("สินค้าบิล-%d", i+1)
				}

				newProd := entity.Product{
					Product_Name:   prodName,
					Product_Code:   "",
					Part_Number:    items[i].CompanyProductCode,
					Barcode:        "",
					Cost_price:     items[i].PricePerUnit,
					Sale_price:     items[i].PricePerUnit * 1.25,
					Is_Active:      true,
					Quantity:       items[i].OrderQuantity,
					Limit_Quantity: 5,
					Models:         []entity.Models{{Model: gorm.Model{ID: 1}}},
					UnitID:         1,
					CategoryID:     catID,
					SubCategoryID:  subCatID,
					GradeID:        1,
					ShelfID:        1,
				}
				if err := tx.Create(&newProd).Error; err != nil {
					return err
				}
				prod = newProd
			} else if err == nil {
				if err := tx.Model(&prod).Update("quantity", prod.Quantity+items[i].OrderQuantity).Error; err != nil {
					return err
				}
			} else {
				return err
			}

			items[i].ProductID = prod.ID

			if err := tx.Create(&items[i]).Error; err != nil {
				return err
			}

			if items[i].ProductID > 0 {
				aiName := items[i].AIProductName
				if aiName == "" {
					aiName = items[i].CompanyProductName
				}
				aiCode := items[i].AIProductCode
				if aiCode == "" {
					aiCode = items[i].CompanyProductCode
				}

				sqlStr := `
					INSERT INTO product_mapping_corrections (supplier_id, ai_product_name, ai_product_code, user_product_name, user_product_code, product_id, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
					ON CONFLICT (supplier_id, ai_product_name, ai_product_code) 
					DO UPDATE SET user_product_name = EXCLUDED.user_product_name, user_product_code = EXCLUDED.user_product_code, product_id = EXCLUDED.product_id, updated_at = NOW()
				`
				if err := tx.Exec(sqlStr, bill.SupplierID, aiName, aiCode, items[i].CompanyProductName, items[i].CompanyProductCode, items[i].ProductID).Error; err != nil {
					println("Warning: failed to save product mapping correction: ", err.Error())
				}
			}
		}

		if job != nil {
			job.ConfirmedBillID = &bill.ID
			job.Status = "CONFIRMED"
			return tx.Save(job).Error
		}

		return nil
	})
}

func (r *billRepository) GetBillByID(id uint) (*entity.Bill, error) {
	var bill entity.Bill
	err := r.db.Preload("BillItems").Preload("Supplier").First(&bill, id).Error
	if err != nil {
		return nil, err
	}
	return &bill, nil
}

func (r *billRepository) UpdateBill(id uint, bill *entity.Bill, items []entity.BillItem) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		bill.ID = id
		if err := tx.Model(bill).Updates(bill).Error; err != nil {
			return err
		}
		if err := tx.Where("bill_id = ?", id).Delete(&entity.BillItem{}).Error; err != nil {
			return err
		}
		for i := range items {
			items[i].BillID = id

			// Ensure items[i].ProductID is valid to satisfy foreign key constraint fk_products_bill_items
			if items[i].ProductID > 0 {
				var count int64
				tx.Model(&entity.Product{}).Where("id = ?", items[i].ProductID).Count(&count)
				if count == 0 {
					items[i].ProductID = 0
				}
			}

			if items[i].ProductID == 0 {
				var prod entity.Product
				prodName := strings.TrimSpace(items[i].CompanyProductName)
				prodCode := strings.TrimSpace(items[i].CompanyProductCode)
				if prodName != "" || prodCode != "" {
					if errMatch := tx.Where("LOWER(TRIM(product_name)) = LOWER(TRIM(?)) OR (LOWER(TRIM(product_code)) = LOWER(TRIM(?)) AND product_code != '')", prodName, prodCode).First(&prod).Error; errMatch == nil {
						items[i].ProductID = prod.ID
					}
				}
				if items[i].ProductID == 0 {
					var firstProd entity.Product
					if errFirst := tx.First(&firstProd).Error; errFirst == nil {
						items[i].ProductID = firstProd.ID
					}
				}
			}

			if err := tx.Create(&items[i]).Error; err != nil {
				return err
			}
		}

		// เมื่อเจ้าของอนุมัติ → อัปเดต cost_price ของสินค้าที่ match
		if bill.IsVerified {
			for _, item := range items {
				if item.ProductID == 0 || item.PricePerUnit <= 0 {
					continue
				}
				if err := tx.Model(&entity.Product{}).
					Where("id = ?", item.ProductID).
					Update("cost_price", item.PricePerUnit).Error; err != nil {
					return err
				}
			}
		}

		return nil
	})
}

func (r *billRepository) DeleteBill(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("bill_id = ?", id).Delete(&entity.BillItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&entity.Bill{}, id).Error
	})
}

func (r *billRepository) FindOrCreateSupplierByName(name string) (uint, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return 1, nil
	}
	var supp entity.Supplier
	err := r.db.Where("LOWER(TRIM(supplier_name)) = LOWER(TRIM(?))", name).First(&supp).Error
	if err == nil {
		return supp.ID, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		newSupp := entity.Supplier{
			SupplierName:      name,
			SupplierAddress:   "-",
			ContactLineSale:   "-",
			PhoneNumberSale:   "-",
			EmailSale:         fmt.Sprintf("supp_%d@autoparts.local", time.Now().UnixNano()),
			BankAccountNumber: "-",
			ShortSupplierName: name,
		}
		if errCreate := r.db.Create(&newSupp).Error; errCreate == nil {
			return newSupp.ID, nil
		}
	}
	return 1, nil
}

func (r *billRepository) ListPurchaseOrders() ([]entity.PO, error) {
	var pos []entity.PO
	err := r.db.Preload("Items").Preload("Supplier").Order("created_at desc").Find(&pos).Error
	return pos, err
}

func (r *billRepository) GetPurchaseOrderByID(id uint) (*entity.PO, error) {
	var po entity.PO
	err := r.db.Preload("Items").Preload("Supplier").First(&po, id).Error
	if err != nil {
		return nil, err
	}
	return &po, nil
}

func (r *billRepository) UpdateImportProduct(id uint, product *entity.Product, modelIDs []uint) error {
	product.ID = id
	updates := map[string]interface{}{
		"product_code":   product.Product_Code,
		"part_number":    product.Part_Number,
		"product_name":   product.Product_Name,
		"barcode":        product.Barcode,
		"quantity":       product.Quantity,
		"limit_quantity": product.Limit_Quantity,
		"cost_price":     product.Cost_price,
		"sale_price":     product.Sale_price,
		"note":           product.Note,
	}

	if product.CategoryID > 0 {
		updates["category_id"] = product.CategoryID
	}
	if product.GradeID > 0 {
		updates["grade_id"] = product.GradeID
	}
	if product.UnitID > 0 {
		updates["unit_id"] = product.UnitID
	}
	if product.ShelfID > 0 {
		updates["shelf_id"] = product.ShelfID
	}

	if err := r.db.Model(&entity.Product{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}

	if len(modelIDs) > 0 {
		var models []entity.Models
		for _, mID := range modelIDs {
			if mID > 0 {
				models = append(models, entity.Models{Model: gorm.Model{ID: mID}})
			}
		}
		if len(models) > 0 {
			r.db.Model(&entity.Product{Model: gorm.Model{ID: id}}).Association("Models").Replace(models)
		}
	}

	return nil
}
