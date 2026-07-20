package wms

import "time"

type SubSubCategoryRequestDTO struct {
	Sub_Sub_Category_Name       string `json:"sub_sub_category_name" binding:"required"`
	Sub_Sub_Category_Short_Name string `json:"sub_sub_category_short_name"`
	Description                 string `json:"description"`
	SubCategoryID               uint   `json:"sub_category_id" binding:"required"`
}

type SubSubCategoryUpdateDTO struct {
	Sub_Sub_Category_Name       string `json:"sub_sub_category_name"`
	Sub_Sub_Category_Short_Name string `json:"sub_sub_category_short_name"`
	Description                 string `json:"description"`
	SubCategoryID               *uint  `json:"sub_category_id"` // optional เพื่อให้เปลี่ยนหมวดหมู่ได้
}

type SubSubCategoryResponseDTO struct {
	ID                          uint   `json:"id"`
	Sub_Sub_Category_Name       string `json:"sub_sub_category_name"`
	Sub_Sub_Category_Short_Name string `json:"sub_sub_category_short_name"`
	Description                 string `json:"description"`
	SubCategoryID               *uint  `json:"sub_category_id"`
	SubCategoryName             string `json:"sub_category_name,omitempty"`
	CreatedAt					time.Time `json:"created_at"`
}
