package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Supplier(db *gorm.DB) error {

	suppliers := []entity.Supplier{
		{
			SupplierName:      "บริษัท ไทยออโต้พาร์ท จำกัด",
			SupplierAddress:   "123 ถ.มิตรภาพ ต.ในเมือง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000",
			ContactLineSale:   "@thaiautopart_sale",
			PhoneNumberSale:   "044-123456",
			EmailSale:         "sale@thaiautopart.co.th",
			BankAccountNumber: "123-4-56789-0",
			ShortSupplierName: "TAP",
		},
		{
			SupplierName:      "ห้างหุ้นส่วนจำกัด โคราชมอเตอร์พาร์ท",
			SupplierAddress:   "456 ถ.สุรนารายณ์ ต.โพธิ์กลาง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000",
			ContactLineSale:   "@koratmotor",
			PhoneNumberSale:   "044-234567",
			EmailSale:         "contact@koratmotor.co.th",
			BankAccountNumber: "987-6-54321-0",
			ShortSupplierName: "KMP",
		},
		{
			SupplierName:      "บริษัท ปตท. หล่อลื่น จำกัด (มหาชน)",
			SupplierAddress:   "555/1 อาคารเอนเนอร์ยี่คอมเพล็กซ์ บี ชั้น 9-12 ถ.วิภาวดีรังสิต แขวงจตุจักร เขตจตุจักร กรุงเทพฯ 10900",
			ContactLineSale:   "@pttoil_korat",
			PhoneNumberSale:   "02-5379000",
			EmailSale:         "korat.branch@pttlubricants.com",
			BankAccountNumber: "111-2-33333-4",
			ShortSupplierName: "PTT-LUB",
		},
		{
			SupplierName:      "บริษัท ยางนครราชสีมา จำกัด",
			SupplierAddress:   "789 ถ.มิตรภาพ-หนองคาย ต.โคกกรวด อ.เมืองนครราชสีมา จ.นครราชสีมา 30280",
			ContactLineSale:   "@yangnakhon",
			PhoneNumberSale:   "044-345678",
			EmailSale:         "sales@yangnakhon.co.th",
			BankAccountNumber: "222-3-44444-5",
			ShortSupplierName: "YNK",
		},
		{
			SupplierName:      "ร้าน อีสานแบตเตอรี่ เซ็นเตอร์",
			SupplierAddress:   "321 ถ.สุรนารายณ์ ต.ในเมือง อ.เมืองนครราชสีมา จ.นครราชสีมา 30000",
			ContactLineSale:   "@esanbattery",
			PhoneNumberSale:   "081-2345678",
			EmailSale:         "info@esanbattery.com",
			BankAccountNumber: "333-4-55555-6",
			ShortSupplierName: "EBC",
		},
	}

	for _, s := range suppliers {
		var result entity.Supplier
		// Unscoped() ตั้งใจใส่ไว้: ต้องเจอแม้แถวนี้เคยถูกลบ (soft delete) ไปแล้วจากการทดสอบฟีเจอร์ลบบริษัท
		// ไม่งั้น FirstOrCreate จะมองไม่เห็นแถวเดิม แล้วพยายาม INSERT ซ้ำ ชน unique constraint ของ email_sale
		// ที่ยังถูกแถวเดิม (แม้ลบไปแล้ว) จับจองอยู่ — ถ้าเจอแถวที่ถูกลบไปแล้วก็ปล่อยผ่าน ไม่ไปฟื้นคืนให้อัตโนมัติ
		err := db.Unscoped().Where("supplier_name = ?", s.SupplierName).
			FirstOrCreate(&result, s).Error
		if err == nil && !result.DeletedAt.Valid {
			db.Model(&result).Updates(s)
		}
		if err != nil {
			return fmt.Errorf("failed to seed supplier %s: %w", s.SupplierName, err)
		}
	}
	return nil
}