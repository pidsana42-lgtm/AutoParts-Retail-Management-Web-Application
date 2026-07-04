package seed

import (
	"backend/internal/app/entity"
	"fmt"
	"gorm.io/gorm"
)

func BillImage(db *gorm.DB) error {
	billImages := []entity.BillImage{
		{ImageURL: "https://storage.googleapis.com/bucket/bill_images/bill_image_001.jpg"},
		{ImageURL: "https://storage.googleapis.com/bucket/bill_images/bill_image_002.jpg"},
		{ImageURL: "https://storage.googleapis.com/bucket/bill_images/bill_image_003.jpg"},
	}

	for _, bi := range billImages {
		var existing entity.BillImage

		result := db.Where("image_url = ?", bi.ImageURL).First(&existing)

		switch result.Error {
		case gorm.ErrRecordNotFound:
			if err := db.Create(&bi).Error; err != nil {
				return fmt.Errorf("failed to create bill image %s: %w", bi.ImageURL, err)
			}
			fmt.Printf("Created BillImage: %s\n", bi.ImageURL)

		case nil:
			// มีอยู่แล้ว ไม่ต้องทำอะไร
			continue

		default:
			return fmt.Errorf("failed to query bill image %s: %w", bi.ImageURL, result.Error)
		}
	}

	return nil
}
