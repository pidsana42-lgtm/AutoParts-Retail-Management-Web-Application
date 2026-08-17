package entity

import (
	"gorm.io/gorm"
	"time"
)

type CheckStockSchedule struct {
	gorm.Model
	Scheduled_DateTime     time.Time `json:"scheduled_datetime"`
	Scheduled_End_DateTime time.Time `json:"scheduled_end_datetime"`
	Status                 string    `json:"status"` // "รอดำเนินการ", "กำลังเช็ค", "รอตรวจสอบ" (พนักงานนับเสร็จ ส่งให้เจ้าของร้านตรวจ), "เสร็จสิ้น"
	Note                   string    `json:"note"`

	// Check Type: "LOCATION", "CATEGORY", "PRODUCT"
	CheckType string `json:"check_type"`

	// Target Fields
	ZoneID           *uint `json:"zone_id"`
	ShelfID          *uint `json:"shelf_id"`
	ShelfLevelID     *uint `json:"shelf_level_id"`
	CategoryID       *uint `json:"category_id"`
	SubCategoryID    *uint `json:"sub_category_id"`
	SubSubCategoryID *uint `json:"sub_sub_category_id"`
	ProductID        *uint `json:"product_id"`

	// Assigned Employee
	UserID *uint `json:"user_id"`
	User   *User `gorm:"foreignKey:UserID" json:"user"`

	CheckStocks []CheckStock `gorm:"foreignKey:CheckStockScheduleID" json:"check_stocks"`
}
