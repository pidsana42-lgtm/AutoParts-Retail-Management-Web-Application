package wms

type GradeRequestDTO struct {
	Grade_Name string `json:"grade_name"`
}

type GradeUpdateDTO struct {
	Grade_Name string `json:"grade_name"`
}

type GradeResponseDTO struct {
	ID         uint   `json:"id"`
	Grade_Name string `json:"grade_name"`
}
