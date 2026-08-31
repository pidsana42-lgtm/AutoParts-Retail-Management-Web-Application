package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func PurchaseOrdersItems(db *gorm.DB) error {
    // 1. ดึงข้อมูลสินค้า (เตรียมไว้ใช้)
    var product entity.Product
    if err := db.Preload("Unit").First(&product).Error; err != nil {
        return fmt.Errorf("failed to find product: %w", err)
    }
    quantity := float64(20.00)
    subTotal := quantity * product.Cost_price

    // 2. สร้างฟังก์ชันช่วยบันทึก (เพื่อลดการเขียนโค้ดซ้ำ)
    saveItem := func(poNumber string) error {
        var po entity.PO
        if err := db.Where("po_number = ?", poNumber).First(&po).Error; err != nil {
            return fmt.Errorf("failed to find PO %s: %w", poNumber, err)
        }

        item := entity.POItems{
            POID:                         po.ID,
            ProductID:                    product.ID,
            Product_name_snapshot:        product.Product_Name,
            Supply_product_code_snapshot: product.CompanyProductCode,
            Quantity:                     quantity,
            Unit:                         product.Unit.Unit_Name,
            UnitPrice:                    product.Cost_price,
            SubTotal:                     subTotal,
        }

        // บันทึกแบบ FirstOrCreate
        return db.Where("po_id = ? AND product_id = ?", item.POID, item.ProductID).
            FirstOrCreate(&entity.POItems{}, item).Error
    }

    // 3. รันบันทึกแยกบิล
    if err := saveItem("PO-2026-0001"); err != nil {
        return err
    }
    fmt.Println("Added item to PO-2026-0001")

    if err := saveItem("PO-2026-0002"); err != nil {
        return err
    }
    fmt.Println("Added item to PO-2026-0002")

    if err := saveItem("PO-2026-0003"); err != nil {
        return err
    }
    fmt.Println("Added item to PO-2026-0003")

    return nil
}