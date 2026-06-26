package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Customer(db *gorm.DB) error {
	customers := []entity.Customer{
		{
			CustomerName:         "เอเป็กซ์ ออโต้ อู่ซ่อมรถ",
			CustomerTypeID:       2, 
			CreditLimit:          100000.00,
			PhoneNumber:          "096-7985115",
			IdCardNumberCustomer: "1-1002-00342-99-1",
			RegisteredAddress:    "140 ม.8 ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000",
			ShippingAddress:      "140 ม.8 ต.ในเมือง อ.เมือง จ.นครราชสีมา 30000",
			CurrentBalance:       0.00,
			StandardDiscountRate: 0.00,
			CurrentDebtAmount:    0.00,
			IsDiscountEnabled:    true,
		},
		{
			CustomerName:         "สมชาย ใจดี",
			CustomerTypeID:       1, 
			CreditLimit:          20000.00,
			PhoneNumber:          "081-2345678",
			IdCardNumberCustomer: "3-3001-00456-78-9",
			RegisteredAddress:    "99 ต.จอหอ อ.เมือง จ.นครราชสีมา 30000",
			ShippingAddress:      "99 ต.จอหอ อ.เมือง จ.นครราชสีมา 30000",
			CurrentBalance:       0.00,
			StandardDiscountRate: 0.00,
			CurrentDebtAmount:    0.00,
			IsDiscountEnabled:    false,
		},
		{
			CustomerName:         "บจก. โคราชคอนสตรัคชั่น 2024",
			CustomerTypeID:       3, 
			CreditLimit:          500000.00,
			PhoneNumber:          "044-222333",
			IdCardNumberCustomer: "0-3055-67001-23-4", // เลขนิติบุคคล
			RegisteredAddress:    "555 ต.โพธิ์กลาง อ.เมือง จ.นครราชสีมา 30000",
			ShippingAddress:      "123 แคมป์ก่อสร้าง ต.โคกกรวด อ.เมือง จ.นครราชสีมา 30000",
			CurrentBalance:       0.00,
			StandardDiscountRate: 0.00,
			CurrentDebtAmount:    0.00,
			IsDiscountEnabled:    true,
		},
	}

	for _, c := range customers {
		var result entity.Customer

		err := db.Where("customer_name = ?", c.CustomerName).
			FirstOrCreate(&result, c).Error

		if err != nil {
			return fmt.Errorf("failed to seed customer %s: %w", c.CustomerName, err)
		}
	}

	return nil
}