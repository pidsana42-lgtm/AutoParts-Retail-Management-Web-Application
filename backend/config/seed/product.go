package seed

import (
    "backend/internal/app/entity"
    "fmt"
    "time"
    "gorm.io/gorm"
)

func Product(db *gorm.DB) error {
    products := []entity.Product{
        {
            Product_Code:    "BR-900X",
            Part_Number:     "PT-TURBO-01",
            Product_Name:    "Turbocharger",
            Barcode:         "8850000000001",
            Quantity:        50,
            Limit_Quantity:  5,
            Sale_price:      870.00,
            Cost_price:      600.00,
            Is_Active:       true,
            Import_DateTime: time.Now(),
            Note:            "เกรด: สูงสมรรถนะ | รุ่นรถที่รองรับ: TOYOTA HILUX REVO 2.8, FORD RANGER RAPTOR 2.0Bi",
            BrandID:         1,
            UnitID:          1,
            CategoryID:      1,
            GradeID:         1,
            ShelfID:         1,
        },
        {
            Product_Code:    "GSK-882",
            Part_Number:     "PT-GASKET-02",
            Product_Name:    "Gasket Set",
            Barcode:         "8850000000002",
            Quantity:        40,
            Limit_Quantity:  10,
            Sale_price:      240.00,
            Cost_price:      150.00,
            Is_Active:       true,
            Import_DateTime: time.Now(),
            Note:            "เกรด: ซิลิโคนทนความร้อนสูง | รุ่นรถที่รองรับ: ISUZU D-MAX 1.9/3.0 (BLUE POWER), MITSUBISHI TRITON",
            BrandID:         1,
            UnitID:          1,
            CategoryID:      1,
            GradeID:         1,
            ShelfID:         1,
        },
        {
            Product_Code:    "OIL-SYN-5W40-X",
            Part_Number:     "PT-OIL-03",
            Product_Name:    "Synthetic Motor Oil 5L",
            Barcode:         "8850000000003",
            Quantity:        30,
            Limit_Quantity:  8,
            Sale_price:      110.00,
            Cost_price:      70.00,
            Is_Active:       true,
            Import_DateTime: time.Now(),
            Note:            "เกรด: สังเคราะห์แท้ | รุ่นรถที่รองรับ: TOYOTA CAMRY 2.5, HONDA CIVIC 1.5T, MAZDA 3 (SKYACTIV)",
            BrandID:         1,
            UnitID:          1,
            CategoryID:      1,
            GradeID:         1,
            ShelfID:         1,
        },
    }

    for _, r := range products {
        var result entity.Product

        err := db.Where("product_code = ?", r.Product_Code).
            FirstOrCreate(&result, r).Error

        if err == nil  {
            db.Model(&result).Updates(r)
        }

        if err != nil {
            return fmt.Errorf("failed to seed product %s: %w", r.Product_Name, err)
        }
    }

    return nil
}