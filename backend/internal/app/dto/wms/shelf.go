package wms

import "time"

type ShelfResponseDTO struct {
	ID          uint                    `json:"id"`
	Shelf_Name  string                  `json:"shelf_name"`
	ZoneID      uint                    `json:"zone_id"`
	CreatedAt   time.Time               `json:"created_at"`
	ShelfLevels []ShelfLevelResponseDTO `json:"shelf_levels"`
}

type ShelfRequestDTO struct {
	Shelf_Name string `json:"shelf_name" binding:"required"`
	ZoneID     uint   `json:"zone_id" binding:"required,gt=0"`
}

type ShelfUpdateDTO struct {
	Shelf_Name string `json:"shelf_name"`
	ZoneID     uint   `json:"zone_id" binding:"required,gt=0"`
}
