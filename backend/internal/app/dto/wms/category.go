package wms

import "time"

type CategoryRequestDTO struct {
	Category_Name       string `json:"category_name" binding:"required"`
	Category_Short_Name string `json:"category_short_name"`
	Description         string `json:"description"`
}

type CategoryUpdateDTO struct {
	Category_Name       string `json:"category_name"`
	Category_Short_Name string `json:"category_short_name"`
	Description         string `json:"description"`
}

type CategoryResponseDTO struct {
	ID                  uint      `json:"id"`
	Category_Name       string    `json:"category_name"`
	Category_Short_Name string    `json:"category_short_name"`
	Description         string    `json:"description"`
	CreatedAt           time.Time `json:"created_at"`
}
