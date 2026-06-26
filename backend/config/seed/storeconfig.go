package seed

import (
    "backend/internal/app/entity"
    "fmt"
    "gorm.io/gorm"
)

func StoreConfig(db *gorm.DB) error {
    var result entity.StoreConfig
    
    // ใช้ Where ค้นหา ID = 1
    // ถ้าไม่เจอ (Attrs จะทำงาน): มันจะเอาข้อมูลใน map (รวมถึง id: 1) ไปทำการ INSERT ให้ทันที
    err := db.Where("id = ?", 1).
        Attrs(map[string]interface{}{
            "id":                      1,
            "max_credit":              50000.00,
            "max_overdue_days":        90,
            "max_item_discount_rate":  2.00,
            "max_extra_discount_rate": 2.00,
            "supervised_pin":          "1234",
        }).
        FirstOrCreate(&result).Error // ส่งแค่ &result เข้าไปเพื่อรับค่ากลับมาพอครับ

    if err != nil {
        return fmt.Errorf("failed to seed store config: %w", err)
    }

    return nil
}