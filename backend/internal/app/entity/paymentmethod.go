package entity

import "gorm.io/gorm"

type PaymentMethod struct {
    gorm.Model
    // User ส่งมา
    MethodName string `gorm:"type:varchar(100);not null;unique" json:"method_name" binding:"required"`

    // ระบบ Set เอง
    IsActive bool `gorm:"type:boolean;not null;default:true" json:"is_active"`
    IsCredit bool `gorm:"type:boolean;not null;default:false" json:"is_credit"`
}
