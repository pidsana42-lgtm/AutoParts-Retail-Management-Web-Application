package seed

import (
    "backend/internal/app/entity"
    "backend/internal/app/enum"
    "gorm.io/gorm"
)

func PaymentMethod(db *gorm.DB) error {
    methods := []entity.PaymentMethod{
        {MethodName: enum.PaymentMethodCash, IsActive: true, IsCredit: false},
        {MethodName: enum.PaymentMethodQR, IsActive: true, IsCredit: false},
        {MethodName: enum.PaymentMethodCredit, IsActive: true, IsCredit: true},
    }

    for _, m := range methods {
        var result entity.PaymentMethod
        // 1. ค้นหาด้วยชื่อก่อน (Where) 
        // 2. ถ้าไม่มีในเบส (Attrs ทำงาน) -> ให้ INSERT ข้อมูลใหม่ทั้งหมดลงไป
        // 3. ถ้ามีในเบสแล้ว (Assign ทำงาน) -> บังคับดึงค่า IsCredit และ IsActive ล่าสุดจากในโค้ดอัปเดตทับลงเบสไปเลย
        err := db.Where("method_name = ?", m.MethodName).
            Attrs(m).  // เคสไม่มีข้อมูล
            Assign(map[string]interface{}{"is_credit": m.IsCredit, "is_active": m.IsActive}). // เคสมีข้อมูลแล้ว แต่อยากให้อัปเดตตามโค้ด
            FirstOrCreate(&result).Error

        if err != nil {
            return err
        }
    }
    return nil
}