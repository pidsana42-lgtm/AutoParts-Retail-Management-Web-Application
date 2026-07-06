package wms

import "time"

type SubCategoryRequestDTO struct {
	Sub_Category_Name       string `json:"sub_category_name" binding:"required"`
	Sub_Category_Short_Name string `json:"sub_category_short_name"`
	Description             string `json:"description"`
	CategoryID              uint   `json:"category_id" binding:"required"`
}

type SubCategoryUpdateDTO struct {
	Sub_Category_Name       string `json:"sub_category_name"`
	Sub_Category_Short_Name string `json:"sub_category_short_name"`
	Description             string `json:"description"`
	CategoryID              *uint  `json:"category_id"` // optional เพื่อให้เปลี่ยนหมวดหมู่ได้
}

type SubCategoryResponseDTO struct {
	ID                      uint      `json:"id"`
	Sub_Category_Name       string    `json:"sub_category_name"`
	Sub_Category_Short_Name string    `json:"sub_category_short_name"`
	Description             string    `json:"description"`
	CategoryID              *uint     `json:"category_id"`
	CategoryName            string    `json:"category_name,omitempty"`
	CreatedAt               time.Time `json:"created_at"`
}
