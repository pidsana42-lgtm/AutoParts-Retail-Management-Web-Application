package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func Models(db *gorm.DB) error {
	// 1. ดึงข้อมูลแบรนด์ที่มีในระบบขึ้นมาเพื่อเอา ID มาผูกความสัมพันธ์ (Relation)
	var brandToyota entity.Brand
	
	if err := db.Where("brand_name = ?", "TOYOTA").First(&brandToyota).Error; err != nil {
		return fmt.Errorf("ไม่พบแบรนด์ TOYOTA ในระบบ กรุณารัน Seed แบรนด์ก่อน: %w", err)
	}


	// 2. ลิสต์ข้อมูลจำลองรุ่นรถยนต์ (ผูก BrandID ตามตารางจริง)
	modelsToSeed := []entity.Models{
		// รุ่นรถฝั่ง TOYOTA
		{
			Model_Name: "HILUX REVO 2.8",
			BrandID:    brandToyota.ID,
		},
		{
			Model_Name: "FORTUNER 3.0",
			BrandID:    brandToyota.ID,
		},
		{
			Model_Name: "HILUX VIGO",
			BrandID:    brandToyota.ID,
		},
		{
			Model_Name: "RANGER RAPTOR 2.0Bi",
			BrandID:    brandToyota.ID,
		},
		{
			Model_Name: "EVEREST 2.0 Turbo",
			BrandID:    brandToyota.ID,
		},
	}

	// 3. วนลูปตรวจสอบแบบปลอดภัย ไม่ให้บันทึกซ้ำซ้อนถ้ามีชื่อรุ่นนั้นอยู่แล้ว
	for _, model := range modelsToSeed {
		var existingModel entity.Models
		err := db.Where("model_name = ? AND brand_id = ?", model.Model_Name, model.BrandID).First(&existingModel).Error
		if err == gorm.ErrRecordNotFound {
			if err := db.Create(&model).Error; err != nil {
				return fmt.Errorf("failed to seed model %s: %w", model.Model_Name, err)
			}
		} else if err != nil {
			return fmt.Errorf("failed to check existing model %s: %w", model.Model_Name, err)
		}
	}

	return nil
}