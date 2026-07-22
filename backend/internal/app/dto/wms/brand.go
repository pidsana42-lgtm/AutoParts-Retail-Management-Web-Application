package wms

type BrandRequestDTO struct {
	BrandName string `json:"brand_name" binding:"required"`
}

type ModelRequestDTO struct {
	ModelName string `json:"model_name" binding:"required"`
	BrandID   uint   `json:"brand_id" binding:"required"`
}
