package wms

import "time"

type ZoneResponseDTO struct {
	ID        uint      `json:"id"`
	Zone_Name string    `json:"zone_name"`
	CreatedAt time.Time `json:"created_at"`
}

type ZoneRequestDTO struct {
	Zone_Name string `json:"zone_name"`
}

type ZoneUpdateDTO struct {
	Zone_Name string `json:"zone_name"`
}
