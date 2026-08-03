package seed

import (
	"backend/internal/app/entity"
	"log"

	"gorm.io/gorm"
)

func SaleOrderItems(db *gorm.DB) error {
	// ดึงสินค้าทั้ง 3 ตัว
	var turbo, gasket, oil entity.Product
	if err := db.Where("product_code = ?", "BR-900X").First(&turbo).Error; err != nil {
		log.Printf("SaleOrderItems seed: product BR-900X not found, skipping")
		return nil
	}
	if err := db.Where("product_code = ?", "GSK-882").First(&gasket).Error; err != nil {
		log.Printf("SaleOrderItems seed: product GSK-882 not found, skipping")
		return nil
	}
	if err := db.Where("product_code = ?", "OIL-SYN-5W40-X").First(&oil).Error; err != nil {
		log.Printf("SaleOrderItems seed: product OIL-SYN-5W40-X not found, skipping")
		return nil
	}

	type orderItems struct {
		orderNumber string
		items       []entity.SaleOrderItem
	}

	orders := []orderItems{
		{
			// SO-2026-0001 สมชาย ใจดี — 2,070 บาท
			orderNumber: "SO-2026-0001",
			items: []entity.SaleOrderItem{
				{
					OrderNumber:    "SO-2026-0001",
					ProductID:      turbo.ID,
					PartNumber:     turbo.Part_Number,
					ProductName:    turbo.Product_Name,
					Qty:            1,
					Unit:           "ชิ้น",
					UnitPrice:      870.00,
					CostPrice:      turbo.Cost_price,
					DiscountType:   "none",
					FinalUnitPrice: 870.00,
					Subtotal:       870.00,
					NetSubtotal:    870.00,
				},
				{
					OrderNumber:    "SO-2026-0001",
					ProductID:      gasket.ID,
					PartNumber:     gasket.Part_Number,
					ProductName:    gasket.Product_Name,
					Qty:            5,
					Unit:           "ชิ้น",
					UnitPrice:      240.00,
					CostPrice:      gasket.Cost_price,
					DiscountType:   "none",
					FinalUnitPrice: 240.00,
					Subtotal:       1200.00,
					NetSubtotal:    1200.00,
				},
			},
		},
		{
			// SO-2026-0002 เอเป็กซ์ ออโต้ — 3,000 บาท (ส่วนลดท้ายบิล 30 บาท)
			orderNumber: "SO-2026-0002",
			items: []entity.SaleOrderItem{
				{
					OrderNumber:    "SO-2026-0002",
					ProductID:      turbo.ID,
					PartNumber:     turbo.Part_Number,
					ProductName:    turbo.Product_Name,
					Qty:            3,
					Unit:           "ชิ้น",
					UnitPrice:      870.00,
					CostPrice:      turbo.Cost_price,
					DiscountType:   "amount",
					DiscountValue:  80.00,
					DiscountAmount: 240.00,
					FinalUnitPrice: 790.00,
					Subtotal:       2370.00,
					NetSubtotal:    2370.00,
				},
				{
					OrderNumber:    "SO-2026-0002",
					ProductID:      gasket.ID,
					PartNumber:     gasket.Part_Number,
					ProductName:    gasket.Product_Name,
					Qty:            2,
					Unit:           "ชิ้น",
					UnitPrice:      240.00,
					CostPrice:      gasket.Cost_price,
					DiscountType:   "none",
					FinalUnitPrice: 240.00,
					Subtotal:       480.00,
					NetSubtotal:    480.00,
				},
				{
					OrderNumber:    "SO-2026-0002",
					ProductID:      oil.ID,
					PartNumber:     oil.Part_Number,
					ProductName:    oil.Product_Name,
					Qty:            1,
					Unit:           "ขวด",
					UnitPrice:      110.00,
					CostPrice:      oil.Cost_price,
					DiscountType:   "none",
					FinalUnitPrice: 110.00,
					Subtotal:       110.00,
					NetSubtotal:    110.00,
				},
			},
		},
		{
			// SO-2026-0003 บจก.โคราชคอนสตรัคชั่น — 9,737.50 บาท (ส่วนลด 5%)
			orderNumber: "SO-2026-0003",
			items: []entity.SaleOrderItem{
				{
					OrderNumber:    "SO-2026-0003",
					ProductID:      turbo.ID,
					PartNumber:     turbo.Part_Number,
					ProductName:    turbo.Product_Name,
					Qty:            10,
					Unit:           "ชิ้น",
					UnitPrice:      870.00,
					CostPrice:      turbo.Cost_price,
					DiscountType:   "none",
					FinalUnitPrice: 870.00,
					Subtotal:       8700.00,
					NetSubtotal:    8265.00,
				},
				{
					OrderNumber:    "SO-2026-0003",
					ProductID:      gasket.ID,
					PartNumber:     gasket.Part_Number,
					ProductName:    gasket.Product_Name,
					Qty:            5,
					Unit:           "ชิ้น",
					UnitPrice:      110.00,
					CostPrice:      gasket.Cost_price,
					DiscountType:   "none",
					FinalUnitPrice: 110.00,
					Subtotal:       550.00,
					NetSubtotal:    522.50,
				},
			},
		},
	}

	for _, o := range orders {
		var so entity.SaleOrder
		if err := db.Where("order_number = ?", o.orderNumber).First(&so).Error; err != nil {
			log.Printf("SaleOrderItems seed: order %s not found, skipping", o.orderNumber)
			continue
		}

		// ข้ามถ้ามี items อยู่แล้ว
		var count int64
		db.Model(&entity.SaleOrderItem{}).Where("order_id = ?", so.ID).Count(&count)
		if count > 0 {
			continue
		}

		for _, item := range o.items {
			item.OrderID = so.ID
			if err := db.Create(&item).Error; err != nil {
				log.Printf("SaleOrderItems seed: failed to create item for %s: %v", o.orderNumber, err)
			}
		}
	}

	return nil
}
