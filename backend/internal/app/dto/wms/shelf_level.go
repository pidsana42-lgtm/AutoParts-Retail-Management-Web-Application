package wms

type ShelfLevelResponseDTO struct {
	ID         uint   `json:"id"`
	Level_Name string `json:"level_name"`
	ShelfID    uint   `json:"shelf_id"`
}

type ShelfLevelRequestDTO struct {
	Level_Name string `json:"level_name" binding:"required"`
	ShelfID    uint   `json:"shelf_id" binding:"required,gt=0"`
}

type ShelfLevelUpdateDTO struct {
	Level_Name string `json:"level_name" binding:"required"`
	ShelfID    uint   `json:"shelf_id" binding:"required,gt=0"`
}
