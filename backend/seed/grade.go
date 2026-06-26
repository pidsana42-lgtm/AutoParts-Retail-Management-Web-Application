package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Grade(db *gorm.DB) error {
	grades := []entity.Grade{
		{Grade_Name: "A"},
		{Grade_Name: "B"},
		{Grade_Name: "C"},
	}

	for _, grade := range grades {
		var result entity.Grade
		err := db.Where("grade_name = ?", grade.Grade_Name).
			FirstOrCreate(&result, grade).Error
		if err == nil {
			db.Model(&result).Updates(grade)
		}
		if err != nil {
			return fmt.Errorf("failed to seed grade %s: %w", grade.Grade_Name, err)
		}
	}
	return nil
}