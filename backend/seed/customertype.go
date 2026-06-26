package seed

import (
    "backend/internal/app/entity"
    "fmt"
    "gorm.io/gorm"
)

func CustomerType(db *gorm.DB) error {
    customerTypes := []entity.CustomerType{
        {TypeName: "GENERAL", TypeLabel: "ลูกค้าทั่วไป"},
        {TypeName: "GARAGE", TypeLabel: "ลูกค้าอู่ซ่อมรถ"},
        {TypeName: "WHOLESALE", TypeLabel: "ลูกค้าบริษัท"},
    }

    for _, ct := range customerTypes {
        var result entity.CustomerType

        err := db.Where("type_name = ?", ct.TypeName).
            FirstOrCreate(&result, entity.CustomerType{
                TypeName:  ct.TypeName,
                TypeLabel: ct.TypeLabel,
            }).
            Error

        if err != nil {
            return fmt.Errorf("failed to seed customer type %s: %w", ct.TypeName, err)
        }
    }

    return nil
}