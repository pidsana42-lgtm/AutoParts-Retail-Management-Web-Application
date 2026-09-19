package repository

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"backend/internal/app/entity"
	"backend/internal/app/enum"
	"backend/internal/pkg/lotcode"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ImportBillRepository interface {
	CreateBill(bill *entity.Bill) error
	ListBills() ([]entity.Bill, error)
	CreateBillImage(img *entity.BillImage) error
	CreateBillImportJob(job *entity.BillImportJob) error
	GetBillImportJobByID(id uint) (*entity.BillImportJob, error)
	SaveBillImportJob(job *entity.BillImportJob) error
	CreateBillItem(item *entity.BillItem) error
	ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob, role string) error

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
	if item.POItemID != nil || item.PreOrderItemID != nil {
		return fmt.Errorf("รายการอ้างอิงใบสั่งซื้อต้องรับเข้าผ่านการยืนยันบิล")
	}
	return r.db.Create(item).Error
}

func (r *billRepository) ConfirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob, role string) error {
	return r.confirmBillImportTransaction(bill, items, job, role, nil)
}

func (r *billRepository) confirmBillImportTransaction(bill *entity.Bill, items []entity.BillItem, job *entity.BillImportJob, role string, verified *bool) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		bill.BillNo = strings.TrimSpace(bill.BillNo)
		if bill.BillNo == "" {
			bill.BillNo = fmt.Sprintf("BILL-%s-%d", time.Now().Format("20060102"), time.Now().UnixNano()%100000)
		}

		// upsertSupplierInventory บันทึก/ปรับยอดในตาราง inventories ต่อ (product, supplier)
		// เพื่อให้ระบบรู้ว่าสินค้าชิ้นนี้รับมาจากบริษัทไหน และรับจากเจ้านั้นไปกี่ชิ้น
		upsertSupplierInventory := func(productID, supplierID uint, qty int, companyProdCode string) error {
			if productID == 0 || supplierID == 0 || qty == 0 {
				return nil
			}
			companyProdCode = strings.TrimSpace(companyProdCode)
			var inv entity.Inventory
			err := tx.Where("product_id = ? AND supplier_id = ?", productID, supplierID).First(&inv).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				// สร้างล็อตใหม่ แล้วออกรหัสล็อตต่อบริษัท (variant code) ไว้พิมพ์ QR/บาร์โค้ดแยกบริษัท
				newInv := entity.Inventory{
					Inventory_Quantity:    qty,
					Last_Updated_DateTime: time.Now(),
					ProductID:             productID,
					SupplierID:            supplierID,
					CompanyProductCode:    companyProdCode,
				}
				if err := tx.Create(&newInv).Error; err != nil {
					return err
				}

				var supp entity.Supplier
				shortName := ""
				if errSup := tx.First(&supp, supplierID).Error; errSup == nil {
					shortName = supp.ShortSupplierName
				}
				var prod entity.Product
				prodCode := ""
				if errProd := tx.Select("product_code").First(&prod, productID).Error; errProd == nil {
					prodCode = prod.Product_Code
				}

				code := lotcode.Build(prodCode, shortName)
				return tx.Model(&entity.Inventory{}).Where("id = ?", newInv.ID).Updates(map[string]interface{}{
					"variant_code":         code,
					"barcode":              code,
					"qr_code":              code,
					"company_product_code": companyProdCode,
				}).Error
			}
			if err != nil {
				return err
			}
			updates := map[string]interface{}{
				"inventory_quantity":     inv.Inventory_Quantity + qty,
				"last_updated_date_time": time.Now(),
			}
			if companyProdCode != "" && inv.CompanyProductCode == "" {
				updates["company_product_code"] = companyProdCode
			}
			if inv.Variant_Code == "" || inv.Barcode == "" || inv.QRCode == "" {
				var supp entity.Supplier
				shortName := ""
				if errSup := tx.First(&supp, supplierID).Error; errSup == nil {
					shortName = supp.ShortSupplierName
				}
				var prod entity.Product
				prodCode := ""
				if errProd := tx.Select("product_code").First(&prod, productID).Error; errProd == nil {
					prodCode = prod.Product_Code
				}
				code := lotcode.Build(prodCode, shortName)
				if inv.Variant_Code == "" {
					updates["variant_code"] = code
				}
				if inv.Barcode == "" {
					updates["barcode"] = code
				}
				if inv.QRCode == "" {
					updates["qr_code"] = code
				}
			}
			return tx.Model(&entity.Inventory{}).Where("id = ?", inv.ID).Updates(updates).Error
		}

		// reverseBillStock subtracts the stock that was added by a previous confirm of this bill.
		// Must be called before deleting the old bill_items, so quantities are still readable.
		stockUnchanged := false
		reverseBillStock := func(billID, supplierID uint) error {
			var old entity.Bill
			if err := tx.Unscoped().First(&old, billID).Error; err != nil {
				return err
			}
			var err error
			stockUnchanged, err = receiptStockUnchanged(tx, &old, bill, items)
			if err != nil {
				return err
			}
			if stockUnchanged {
				return nil
			}
			return reverseReceiptStock(tx, billID, supplierID)
		}

		// recordBillStockIn บันทึกแถว stock_movements (movement_type = IN, ผูก BillID) ทุกครั้งที่บิลนี้ทำให้
		// สต็อกสินค้าเพิ่มขึ้นจริง เพื่อให้การรับสินค้าเข้าเพิ่มจากบิลซื้อปรากฏในฟีด "การเคลื่อนไหวของสินค้า" เหมือนช่องทาง
		// รับเข้าอื่นๆ ของ WMS — ก่อนหน้านี้เส้นทางนี้ปรับ quantity ตรงๆ โดยไม่ทิ้งร่องรอยไว้เลย
		recordBillStockIn := func(productID uint, supplierID uint, qty int, note string) error {
			if productID == 0 || qty <= 0 {
				return nil
			}
			var userID *uint
			if bill.VerifiedBy > 0 {
				userID = &bill.VerifiedBy
			}
			return tx.Create(&entity.StockMovement{
				Movement_Type:     "IN",
				Quantity:          qty,
				Movement_DateTime: time.Now(),
				Note:              note,
				ProductID:         productID,
				SupplierID:        &supplierID,
				UserID:            userID,
				BillID:            &bill.ID,
			}).Error
		}

		var existingBill entity.Bill
		errExist := tx.Unscoped().Clauses(clause.Locking{Strength: "UPDATE"}).Where("LOWER(TRIM(bill_no)) = LOWER(TRIM(?))", bill.BillNo).First(&existingBill).Error

		if errExist == nil && existingBill.ID > 0 {
			if bill.ID != 0 && bill.ID != existingBill.ID {
				return fmt.Errorf("เลขที่บิลซ้ำกับบิลอื่น")
			}
			if bill.POID == nil {
				bill.POID = existingBill.POID
			}
			bill.ID = existingBill.ID
			if existingBill.DeletedAt.Valid {
				if err := tx.Unscoped().Model(&existingBill).Update("deleted_at", nil).Error; err != nil {
					return err
				}
			}
			if err := reverseBillStock(existingBill.ID, existingBill.SupplierID); err != nil {
				return err
			}
			if err := tx.Unscoped().Model(&existingBill).Updates(bill).Error; err != nil {
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
					if bill.POID == nil {
						bill.POID = linkedBill.POID
					}
					bill.ID = targetID
					if linkedBill.DeletedAt.Valid {
						if err := tx.Unscoped().Model(&linkedBill).Update("deleted_at", nil).Error; err != nil {
							return err
						}
					}
					if err := reverseBillStock(targetID, linkedBill.SupplierID); err != nil {
						return err
					}
					if err := tx.Unscoped().Model(&linkedBill).Updates(bill).Error; err != nil {
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

		if err := validateReceiptLinks(tx, bill, items); err != nil {
			return err
		}
		if err := tx.Model(bill).Update("po_id", bill.POID).Error; err != nil {
			return err
		}
		isDraft := strings.EqualFold(bill.PaymentStatus, "draft")
		var changedItems []entity.BillItem

		for i := range items {
			items[i].BillID = bill.ID
			receiptQuantity := items[i].OrderQuantity
			if isDraft || stockUnchanged {
				receiptQuantity = 0
			}

			var prod entity.Product
			var err error

			if items[i].ProductID > 0 {
				err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("id = ?", items[i].ProductID).First(&prod).Error
			} else {
				prodName := strings.TrimSpace(items[i].CompanyProductName)
				prodCode := strings.TrimSpace(items[i].CompanyProductCode)
				// กรณีชื่อ/รหัสซ้ำกันมีหลายสินค้า (ชื่อเดียวกันแต่ต่างบริษัท) → เลือกตัวที่เคยรับจากบริษัทนี้มาก่อน
				// แล้วค่อย fallback เป็นตัวที่ id เก่าสุด เพื่อให้ผลลัพธ์คาดเดาได้เสมอ
				err = tx.Clauses(clause.Locking{Strength: "UPDATE"}).Where("LOWER(TRIM(product_name)) = LOWER(TRIM(?)) OR (LOWER(TRIM(product_code)) = LOWER(TRIM(?)) AND product_code != '')", prodName, prodCode).
					Order(fmt.Sprintf("CASE WHEN EXISTS (SELECT 1 FROM inventories i WHERE i.product_id = products.id AND i.supplier_id = %d AND i.deleted_at IS NULL) THEN 0 ELSE 1 END", bill.SupplierID)).
					Order("id").
					First(&prod).Error
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
				var subSubCatID *uint
				if items[i].SubSubCategoryID != nil && *items[i].SubSubCategoryID > 0 {
					subSubCatID = items[i].SubSubCategoryID
				}

				prodName := strings.TrimSpace(items[i].CompanyProductName)
				if prodName == "" {
					prodName = fmt.Sprintf("สินค้าบิล-%d", i+1)
				}

				newProd := entity.Product{
					Import_DateTime:  bill.ReceiveDate,
					Product_Name:     prodName,
					Product_Code:     "",
					Part_Number:      items[i].CompanyProductCode,
					Cost_price:       items[i].PricePerUnit,
					Sale_price:       items[i].PricePerUnit * 1.25,
					Is_Active:        true,
					Quantity:         receiptQuantity,
					Limit_Quantity:   5,
					Models:           []entity.Models{{Model: gorm.Model{ID: 1}}},
					UnitID:           1,
					CategoryID:       catID,
					SubCategoryID:    subCatID,
					SubSubCategoryID: subSubCatID,
					GradeID:          1,
					ShelfID:          1,
				}
				if err := tx.Create(&newProd).Error; err != nil {
					return err
				}
				prod = newProd

				// ผูกสินค้าใหม่เข้ากับบริษัทที่นำเข้าบิลนี้ ตั้งแต่ชิ้นแรก
				if err := upsertSupplierInventory(prod.ID, bill.SupplierID, receiptQuantity, items[i].CompanyProductCode); err != nil {
					return err
				}
			} else if err == nil {
				if err := tx.Model(&prod).Update("quantity", prod.Quantity+receiptQuantity).Error; err != nil {
					return err
				}
				// บวกยอดเข้าบริษัทของบิลนี้ — ทำให้สินค้าชื่อเดียวกันจากต่างบริษัทไล่ยอด/ที่มาแยกกันได้
				if err := upsertSupplierInventory(prod.ID, bill.SupplierID, receiptQuantity, items[i].CompanyProductCode); err != nil {
					return err
				}
				// สินค้าที่มีอยู่แล้วรับเข้าเพิ่ม -> บันทึกลงฟีดการเคลื่อนไหว (สินค้าใหม่ไม่ต้องซ้ำ เพราะมี PRODUCT_ADDED
				// ที่โชว์จำนวนเริ่มต้นให้อยู่แล้วตอนสร้างแถวสินค้าด้านบน)
				billNote := fmt.Sprintf("รับเข้าจากบิลซื้อ %s", bill.BillNo)
				if err := recordBillStockIn(prod.ID, bill.SupplierID, receiptQuantity, billNote); err != nil {
					return err
				}
				if items[i].PricePerUnit > 0 && items[i].PricePerUnit != prod.Cost_price {
					changed := items[i]
					changed.ProductID = prod.ID
					changedItems = append(changedItems, changed)
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

		bill.PriceChangeDetected = len(changedItems) > 0

		isOwner := strings.EqualFold(role, string(enum.RoleOwner)) || strings.EqualFold(role, string(enum.RoleManager)) || strings.EqualFold(role, "Owner") || strings.EqualFold(role, "Manager") || strings.EqualFold(role, "Admin")
		autoApprove := isOwner || len(changedItems) == 0
		if verified != nil {
			autoApprove = *verified
		}
		if isDraft {
			autoApprove = false
		}
		if autoApprove {
			if err := tx.Model(&entity.Bill{}).Where("id = ?", bill.ID).Update("is_verified", true).Error; err != nil {
				return err
			}
			bill.IsVerified = true
			for _, item := range changedItems {
				if item.ProductID > 0 {
					if err := tx.Model(&entity.Product{}).
						Where("id = ?", item.ProductID).
						Update("cost_price", item.PricePerUnit).Error; err != nil {
						return err
					}
				}
			}
		} else {
			// GORM's struct-based Updates(bill) above skips zero-value fields (like IsVerified: false),
			// so a bill_no reused from a previously-approved bill would otherwise keep the stale
			// is_verified=true. Force it back to pending explicitly whenever auto-approval doesn't apply.
			if err := tx.Model(&entity.Bill{}).Where("id = ?", bill.ID).Update("is_verified", false).Error; err != nil {
				return err
			}
			bill.IsVerified = false
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
	err := r.db.Preload("BillItems").Preload("Supplier").Preload("BillImage").First(&bill, id).Error
	if err != nil {
		return nil, err
	}
	return &bill, nil
}

func (r *billRepository) UpdateBill(id uint, bill *entity.Bill, items []entity.BillItem) error {
	bill.ID = id
	verified := bill.IsVerified
	return r.confirmBillImportTransaction(bill, items, nil, "", &verified)
}

func (r *billRepository) DeleteBill(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var bill entity.Bill
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).First(&bill, id).Error; err != nil {
			return err
		}
		if err := reverseReceiptStock(tx, id, bill.SupplierID); err != nil {
			return err
		}
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
	err := r.db.Preload("PO_Items").Preload("Supplier").Order("created_at desc").Find(&pos).Error
	return pos, err
}

func (r *billRepository) GetPurchaseOrderByID(id uint) (*entity.PO, error) {
	var po entity.PO
	err := r.db.Preload("PO_Items").Preload("Supplier").First(&po, id).Error
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
