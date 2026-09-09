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
			Quantity:        50,
			Limit_Quantity:  5,
			Sale_price:      870.00,
			Cost_price:      600.00,
			MaxDiscountRate: 2.0, // กำหนดเพดานส่วนลดสูงสุดเป็น 2%
			Is_Active:       true,
			Import_DateTime: time.Now(),
			Note:            "เกรด: สูงสมรรถนะ | รุ่นรถที่รองรับ: TOYOTA HILUX REVO 2.8, FORD RANGER RAPTOR 2.0Bi",
			Models:          []entity.Models{{Model: gorm.Model{ID: 1}}},
			UnitID:          1,
			CategoryID:      1,
			GradeID:         1,
			ShelfID:         1,
		},
		{
			Product_Code:    "GSK-882",
			Part_Number:     "PT-GASKET-02",
			Product_Name:    "Gasket Set",
			Quantity:        40,
			Limit_Quantity:  10,
			Sale_price:      240.00,
			Cost_price:      150.00,
			MaxDiscountRate: 5.0, // กำหนดเพดานส่วนลดสูงสุดเป็น 5%
			Is_Active:       true,
			Import_DateTime: time.Now(),
			Note:            "เกรด: ซิลิโคนทนความร้อนสูง | รุ่นรถที่รองรับ: ISUZU D-MAX 1.9/3.0 (BLUE POWER), MITSUBISHI TRITON",
			Models:          []entity.Models{{Model: gorm.Model{ID: 1}}},
			UnitID:          1,
			CategoryID:      1,
			GradeID:         1,
			ShelfID:         1,
		},
		{
			Product_Code:    "OIL-SYN-5W40-X",
			Part_Number:     "PT-OIL-03",
			Product_Name:    "Synthetic Motor Oil 5L",
			Quantity:        30,
			Limit_Quantity:  8,
			Sale_price:      110.00,
			Cost_price:      70.00,
			MaxDiscountRate: 3.0, // กำหนดเพดานส่วนลดสูงสุดเป็น 3%
			Is_Active:       true,
			Import_DateTime: time.Now(),
			Note:            "เกรด: สังเคราะห์แท้ | รุ่นรถที่รองรับ: TOYOTA CAMRY 2.5, HONDA CIVIC 1.5T, MAZDA 3 (SKYACTIV)",
			Models:          []entity.Models{{Model: gorm.Model{ID: 1}}},
			UnitID:          1,
			CategoryID:      1,
			GradeID:         1,
			ShelfID:         1,
		},
	}

	for _, r := range products {
		var existing entity.Product

		result := db.Where("product_code = ?", r.Product_Code).First(&existing)

		switch result.Error {
		case gorm.ErrRecordNotFound:
			if err := db.Create(&r).Error; err != nil {
				return fmt.Errorf("failed to create product %s: %w", r.Product_Name, err)
			}
			fmt.Printf("Created: %s\n", r.Product_Name)

		case nil:
			r.ID = existing.ID
			if err := db.Model(&existing).Updates(r).Error; err != nil {
				return fmt.Errorf("failed to update product %s: %w", r.Product_Name, err)
			}
			if err := db.Model(&existing).Association("Models").Replace(r.Models); err != nil {
				return fmt.Errorf("failed to update product models %s: %w", r.Product_Name, err)
			}
			fmt.Printf("Updated: %s\n", r.Product_Name)

		default:
			return fmt.Errorf("failed to query product %s: %w", r.Product_Name, result.Error)
		}
	}
	return nil
}
