package wms

type ZoneResponseDTO struct {
	ID        uint   `json:"id"`
	Zone_Name string `json:"zone_name"`
}

type ZoneRequestDTO struct {
	Zone_Name string `json:"zone_name"`
}

type ZoneUpdateDTO struct {
	Zone_Name string `json:"zone_name"`
}