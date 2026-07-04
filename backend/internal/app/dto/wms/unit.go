package wms

type UnitRequestDTO struct {
	Unit_Name string `json:"unit_name"`
}

type UnitUpdateDTO struct {
	Unit_Name string `json:"unit_name"`
}

type UnitResponseDTO struct {
	ID        uint   `json:"id"`
	Unit_Name string `json:"unit_name"`
}