package seed

import (
	"backend/internal/app/entity"
	"backend/internal/app/enum"
	// "fmt"
	"log"
	"time"

	"gorm.io/gorm"
)

func SaleOrder(db *gorm.DB) error {
	now := time.Now()
	due30 := now.AddDate(0, 0, 30)
	paidNow := now

	saleOrders := []entity.SaleOrder{
		// 1) SO-2026-0001 ขายเงินสด จ่ายครบ มีเงินทอน
		{
			OrderNumber:        "SO-2026-0001",
			OrderDate:          now,
			CustomerID:         2, // สมชาย ใจดี
			Status:             enum.OrderCompleted,
			PaymentStatus:      enum.PaymentPaid,
			Subtotal:           2070.00,
			BillDiscountType:   "none",
			BillDiscountValue:  0.00,
			DiscountAmount:     0.00,
			DiscountPercent:    0.00,
			TotalDiscountItems: 0.00,
			TotalAmount:        2070.00,
			PaidAmount:         2100.00,
			BalanceDue:         0.00,
			ChangeAmount:       30.00,
			PaidDate:           &paidNow,
			Note:               "ขายหน้าร้าน เงินสด",
		},
		// 2) SO-2026-0002 ขายเครดิต จ่ายบางส่วน + ส่วนลดรายชิ้น
		{
			OrderNumber:        "SO-2026-0002",
			OrderDate:          now,
			CustomerID:         1, // เอเป็กซ์ ออโต้
			Status:             enum.OrderCompleted,
			PaymentStatus:      enum.PaymentPartial,
			Subtotal:           3030.00,
			BillDiscountType:   "amount",
			BillDiscountValue:  30.00,
			DiscountAmount:     30.00,
			DiscountPercent:    0.00,
			TotalDiscountItems: 240.00,
			TotalAmount:        3000.00,
			PaidAmount:         1000.00,
			BalanceDue:         2000.00,
			ChangeAmount:       0.00,
			DueDate:            &due30,
			Note:               "ขายเครดิต มัดจำบางส่วน",
		},
		// 3) SO-2026-0003 ขายเครดิต ยังไม่จ่าย + ส่วนลดท้ายบิล %
		{
			OrderNumber:        "SO-2026-0003",
			OrderDate:          now,
			CustomerID:         3, // บจก.โคราชคอนสตรัคชั่น
			Status:             enum.OrderPending,
			PaymentStatus:      enum.PaymentUnpaid,
			Subtotal:           10250.00,
			BillDiscountType:   "percentage",
			BillDiscountValue:  5.00,
			DiscountAmount:     512.50,
			DiscountPercent:    5.00,
			TotalDiscountItems: 0.00,
			TotalAmount:        9737.50,
			PaidAmount:         0.00,
			BalanceDue:         9737.50,
			ChangeAmount:       0.00,
			DueDate:            &due30,
			Note:               "ขายเครดิตโครงการก่อสร้าง",
		},
	}

	for _, so := range saleOrders {
		if err := db.FirstOrCreate(&so, &entity.SaleOrder{OrderNumber: so.OrderNumber}).Error; err != nil {
			log.Fatalf("failed to seed sale order %s: %w", so.OrderNumber, err)
		}
		
	}
	return nil
}
