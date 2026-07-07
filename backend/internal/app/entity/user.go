package entity

import "gorm.io/gorm"

type User struct {
    gorm.Model
    // User กรอกมา
    FirstName        string `gorm:"type:varchar(100);not null" json:"first_name" binding:"required"`
    LastName         string `gorm:"type:varchar(100);not null" json:"last_name" binding:"required"`
    IdCardNumberUser string `gorm:"type:varchar(20);not null;unique" json:"id_card_number_user" binding:"required"`
    Username         string `gorm:"type:varchar(100);not null;uniqueIndex" json:"username" binding:"required"`
    Password         string `gorm:"type:varchar(255);not null" json:"password" binding:"required"`
    LineUserID       string `gorm:"type:varchar(100);uniqueIndex" json:"line_user_id"`

    // ระบบกำหนดให้
    StoreConfigID uint        `gorm:"not null" json:"store_config_id"`
    StoreConfig   StoreConfig `gorm:"foreignKey:StoreConfigID" json:"store_config"`

    // User เลือกมา
    BankID uint `gorm:"not null" json:"bank_id" binding:"required"`
    Bank   Bank `gorm:"foreignKey:BankID" json:"bank"`

    BankAccountNumber string `gorm:"type:varchar(50);not null" json:"bank_account_number" binding:"required"`

    // Admin กำหนดให้
    RoleID uint `gorm:"not null" json:"role_id"`
    Role   Role `gorm:"foreignKey:RoleID" json:"role"`

    // Toto WMS
    StockMovements []StockMovement `gorm:"foreignKey:UserID" json:"stock_movements"`
    CheckStocks []CheckStock `gorm:"foreignKey:UserID" json:"check_stocks"`
}
