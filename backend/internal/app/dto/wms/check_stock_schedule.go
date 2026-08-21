package wms

import "time"

type CheckStockScheduleRequestDTO struct {
	Scheduled_DateTime     time.Time `json:"scheduled_datetime" binding:"required"`
	Scheduled_End_DateTime time.Time `json:"scheduled_end_datetime" binding:"required,gtfield=Scheduled_DateTime"`
	Note                   string    `json:"note"`
	CheckType              string    `json:"check_type" binding:"required"` // "LOCATION", "CATEGORY", "PRODUCT"
	ZoneID                 *uint     `json:"zone_id"`
	ShelfID                *uint     `json:"shelf_id"`
	ShelfLevelID           *uint     `json:"shelf_level_id"`
	CategoryID             *uint     `json:"category_id"`
	SubCategoryID          *uint     `json:"sub_category_id"`
	SubSubCategoryID       *uint     `json:"sub_sub_category_id"`
	ProductID              *uint     `json:"product_id"`
	UserID                 *uint     `json:"user_id"`
}

type CheckStockScheduleResponseDTO struct {
	ID                     uint      `json:"id"`
	Scheduled_DateTime     time.Time `json:"scheduled_datetime"`
	Scheduled_End_DateTime time.Time `json:"scheduled_end_datetime"`
	Status                 string    `json:"status"`
	Note                   string    `json:"note"`
	CreatedAt              time.Time `json:"created_at"`

	CheckType        string `json:"check_type"`
	ZoneID           *uint  `json:"zone_id"`
	ShelfID          *uint  `json:"shelf_id"`
	ShelfLevelID     *uint  `json:"shelf_level_id"`
	CategoryID       *uint  `json:"category_id"`
	SubCategoryID    *uint  `json:"sub_category_id"`
	SubSubCategoryID *uint  `json:"sub_sub_category_id"`
	ProductID        *uint  `json:"product_id"`

	UserID       *uint  `json:"user_id"`
	UserFullName string `json:"user_full_name"`
	AccessToken  string `json:"access_token"`

	// Derived Fields for UI
	TargetName   string `json:"target_name"`   // e.g., "Zone A (RACK 04 - LEVEL 2)" or "Category: Engine Oil"
	ProductCount int    `json:"product_count"` // Number of products expected in this check
}
