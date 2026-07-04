package entity

import (
	"gorm.io/gorm"
	"time"
)

type CheckStock struct {
	gorm.Model
	Old_Quantity        int       `json:"old_quantity"`
	New_Quantity        int       `json:"new_quantity"`
	Diff_Quantity       int       `json:"diff_quantity"`
	Reason              string    `json:"reason"`
	Adjustment_DateTime time.Time `json:"adjustment_datetime"`

	ProductID  *uint     `json:"product_id"`
	Product    *Product `gorm:"foreignKey:ProductID" json:"product"`
	SupplierID *uint     `json:"supplier_id"`
	Supplier   *Supplier `gorm:"foreignKey:SupplierID" json:"supplier"`
	UserID     *uint     `json:"user_id"`
	User       *User    `gorm:"foreignKey:UserID" json:"user"`

	CheckStockScheduleID *uint               `json:"check_stock_schedule_id"`
	CheckStockSchedule   *CheckStockSchedule `gorm:"foreignKey:CheckStockScheduleID" json:"check_stock_schedule"`
}