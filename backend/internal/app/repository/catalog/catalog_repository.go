package catalog

import (
	"backend/internal/app/entity"
	"gorm.io/gorm"
)

type CatalogRepository interface {
	CreateCatalog(catalog *entity.Catalog) error
	GetCatalogByID(id uint) (*entity.Catalog, error)
	ListCatalogs(search string, brand string, category string) ([]entity.Catalog, error)
	UpdateCatalog(catalog *entity.Catalog) error
	DeleteCatalog(id uint) error
	SearchCatalogItems(search string, brand string) ([]entity.CatalogItem, error)
	SeedDefaultCatalogsIfEmpty() error
}

type catalogRepository struct {
	db *gorm.DB
}

func NewCatalogRepository(db *gorm.DB) CatalogRepository {
	return &catalogRepository{db: db}
}

func (r *catalogRepository) CreateCatalog(catalog *entity.Catalog) error {
	return r.db.Create(catalog).Error
}

func (r *catalogRepository) GetCatalogByID(id uint) (*entity.Catalog, error) {
	var cat entity.Catalog
	err := r.db.Preload("Supplier").
		Preload("CatalogItems").
		First(&cat, id).Error
	if err != nil {
		return nil, err
	}
	return &cat, nil
}

func (r *catalogRepository) ListCatalogs(search string, brand string, category string) ([]entity.Catalog, error) {
	var catalogs []entity.Catalog
	query := r.db.Preload("Supplier").Preload("CatalogItems")

	if search != "" {
		like := "%" + search + "%"
		query = query.Where("catalog_code ILIKE ? OR catalog_name ILIKE ? OR brand ILIKE ? OR description ILIKE ?", like, like, like, like)
	}
	if brand != "" {
		query = query.Where("brand = ?", brand)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}

	err := query.Order("id DESC").Find(&catalogs).Error
	return catalogs, err
}

func (r *catalogRepository) UpdateCatalog(catalog *entity.Catalog) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if len(catalog.CatalogItems) > 0 {
			if err := tx.Where("catalog_id = ?", catalog.ID).Delete(&entity.CatalogItem{}).Error; err != nil {
				return err
			}
		}
		return tx.Save(catalog).Error
	})
}

func (r *catalogRepository) DeleteCatalog(id uint) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("catalog_id = ?", id).Delete(&entity.CatalogItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&entity.Catalog{}, id).Error
	})
}

func (r *catalogRepository) SearchCatalogItems(search string, brand string) ([]entity.CatalogItem, error) {
	var items []entity.CatalogItem
	query := r.db.Preload("Catalog")

	if search != "" {
		like := "%" + search + "%"
		query = query.Where("part_number ILIKE ? OR part_name ILIKE ? OR compatible_cars ILIKE ?", like, like, like)
	}
	if brand != "" {
		query = query.Where("brand = ?", brand)
	}

	err := query.Limit(100).Find(&items).Error
	return items, err
}

func (r *catalogRepository) SeedDefaultCatalogsIfEmpty() error {
	var count int64
	r.db.Model(&entity.Catalog{}).Count(&count)
	if count > 0 {
		return nil
	}

	samples := []entity.Catalog{
		{
			CatalogCode: "CAT-DENSO-2026",
			CatalogName: "Denso Ignition & Electrical Parts Catalog 2026",
			Brand:       "DENSO",
			Category:    "ระบบไฟและจุดระเบิด",
			SupplierID:  1,
			Description: "คู่มือและรายการอะไหล่หัวเทียน ไดชาร์จ ไดสตาร์ท และเซนเซอร์ควบคุมเครื่องยนต์สำหรับรถยนต์ญี่ปุ่นและรถยุโรป",
			CoverImage:  "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80",
			CatalogFile: "",
			IsActive:    true,
			CatalogItems: []entity.CatalogItem{
				{PartNumber: "SK20R11", PartName: "หัวเทียน Iridium Power SK20R11", Brand: "DENSO", CompatibleCars: "Toyota Vios, Yaris, Altis, Camry", StandardPrice: 320, Unit: "หัว", Remark: "เกรดแท้ศูนย์ ทนทาน 100,000 กม."},
				{PartNumber: "FXE20HR11", PartName: "หัวเทียน Iridium Tough FXE20HR11", Brand: "DENSO", CompatibleCars: "Nissan March, Almera, Sylphy, Teana", StandardPrice: 380, Unit: "หัว", Remark: "แกนอิริเดียม 0.4mm"},
				{PartNumber: "IK16TT", PartName: "หัวเทียน Twin Tip IK16TT", Brand: "DENSO", CompatibleCars: "Honda Civic, City, Jazz (L15A/R18A)", StandardPrice: 290, Unit: "หัว", Remark: "เพิ่มอัตราเร่ง ประหยัดน้ำมัน"},
				{PartNumber: "029600-0570", PartName: "ออกซิเจนเซนเซอร์ (O2 Sensor)", Brand: "DENSO", CompatibleCars: "Toyota Hilux Vigo 1KD/2KD", StandardPrice: 1650, Unit: "ตัว", Remark: "Upstream Sensor ปลั๊กตรงรุ่น"},
				{PartNumber: "104210-9010", PartName: "ไดชาร์จ (Alternator 12V 100A)", Brand: "DENSO", CompatibleCars: "Isuzu D-Max 4JJ1/4JK1 2.5/3.0", StandardPrice: 4200, Unit: "ลูก", Remark: "บิวท์แท้โรงงาน OEM"},
			},
		},
		{
			CatalogCode: "CAT-TRW-2026",
			CatalogName: "TRW Suspension & Brake Systems Catalog 2026",
			Brand:       "TRW",
			Category:    "ระบบช่วงล่างและเบรก",
			SupplierID:  1,
			Description: "แคตตาล็อกระบบเบรก ผ้าเบรก จานเบรก ลูกหมาก ปีกนก และโช้คอัพมาตรฐานยุโรป",
			CoverImage:  "https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=600&auto=format&fit=crop&q=80",
			CatalogFile: "",
			IsActive:    true,
			CatalogItems: []entity.CatalogItem{
				{PartNumber: "GDB328DT", PartName: "ผ้าดิสเบรกหน้า D-Tec Ceramic GDB328DT", Brand: "TRW", CompatibleCars: "Toyota Revo 4WD, Fortuner 2015+", StandardPrice: 1250, Unit: "ชุด", Remark: "ไร้ฝุ่นดำ เสียงเงียบ นุ่มเท้า"},
				{PartNumber: "GDB1143", PartName: "ผ้าดิสเบรกหน้า Lucas GDB1143", Brand: "TRW", CompatibleCars: "Isuzu D-Max All New 2012-2019", StandardPrice: 980, Unit: "ชุด", Remark: "ทนความร้อนสูง เบรกสั้นกระชับ"},
				{PartNumber: "JBJ7538", PartName: "ลูกหมากปีกนกล่าง JBJ7538", Brand: "TRW", CompatibleCars: "Toyota Vios / Yaris NCP93, NSP152", StandardPrice: 580, Unit: "ตัว", Remark: "เหล็กฟอร์จแข็งแรงพิเศษ"},
				{PartNumber: "JTE7576", PartName: "ลูกหมากคันชักนอก JTE7576", Brand: "TRW", CompatibleCars: "Honda Civic FD 1.8/2.0 (2006-2011)", StandardPrice: 520, Unit: "ตัว", Remark: "เกลียวซ้าย/ขวา มาตรฐาน OEM"},
				{PartNumber: "DF7372", PartName: "จานดิสเบรกหน้า High Carbon DF7372", Brand: "TRW", CompatibleCars: "Mazda 2 Skyactiv / CX-3 (2015+)", StandardPrice: 1450, Unit: "ใบ", Remark: "เคลือบสารกันสนิม Black Paint"},
			},
		},
		{
			CatalogCode: "CAT-KUBOTA-2026",
			CatalogName: "Kubota Agricultural & Tractor Parts Catalog 2026",
			Brand:       "KUBOTA",
			Category:    "อะไหล่เครื่องจักรกลการเกษตร",
			SupplierID:  1,
			Description: "รายการอะไหล่แท้และอะไหล่ทดแทนสำหรับแทรกเตอร์ รถไถ และเครื่องยนต์ดีเซลคูโบต้า L-Series, M-Series, RT-Series",
			CoverImage:  "https://images.unsplash.com/photo-1592878904946-b3cd8ae243d0?w=600&auto=format&fit=crop&q=80",
			CatalogFile: "",
			IsActive:    true,
			CatalogItems: []entity.CatalogItem{
				{PartNumber: "15221-73010", PartName: "ปั๊มน้ำเครื่องยนต์แทรกเตอร์ (Water Pump)", Brand: "KUBOTA", CompatibleCars: "Kubota MU4902, L4508, L5018", StandardPrice: 2312.50, Unit: "ตัว", Remark: "พร้อมปะเก็นและซีลกันน้ำรั่ว"},
				{PartNumber: "HH150-32430", PartName: "กรองน้ำมันเครื่องแทรกเตอร์ (Oil Filter)", Brand: "KUBOTA", CompatibleCars: "Kubota L3408, L3608, L4018, L4708", StandardPrice: 195, Unit: "ลูก", Remark: "ไส้กรองกระดาษ Micro-fiber ดักจับตะกอนละเอียด"},
				{PartNumber: "6A320-58862", PartName: "กรองโซล่าแทรกเตอร์ (Fuel Filter Assembly)", Brand: "KUBOTA", CompatibleCars: "Kubota B2140, B2440, L5018, M6040", StandardPrice: 280, Unit: "ลูก", Remark: "ช่วยกรองน้ำและสิ่งสกปรกในน้ำมันดีเซล"},
				{PartNumber: "34070-16280", PartName: "แผ่นคลัตช์แทรกเตอร์ 9.5 นิ้ว (Clutch Disc)", Brand: "KUBOTA", CompatibleCars: "Kubota L4508, L5018 (เครื่องยนต์ V2203/V2403)", StandardPrice: 1850, Unit: "แผ่น", Remark: "ผ้าคลัตช์ทองแดงผสม ทนงานหนัก"},
			},
		},
		{
			CatalogCode: "CAT-BOSCH-2026",
			CatalogName: "Bosch Filters, Wipers & Electrical Catalog",
			Brand:       "BOSCH",
			Category:    "ไส้กรอง ใบปัด และอุปกรณ์ไฟฟ้า",
			SupplierID:  1,
			Description: "แคตตาล็อกระบบกรองอากาศ กรองแอร์ ใบปัดน้ำฝน และมอเตอร์ปั๊มติ๊กเชื้อเพลิง",
			CoverImage:  "https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&auto=format&fit=crop&q=80",
			CatalogFile: "",
			IsActive:    true,
			CatalogItems: []entity.CatalogItem{
				{PartNumber: "0986AF0059", PartName: "กรองอากาศเครื่องยนต์ MegaFilter", Brand: "BOSCH", CompatibleCars: "Toyota Vigo, Fortuner, Innova 2.5/2.7/3.0", StandardPrice: 280, Unit: "อัน", Remark: "การไหลของอากาศถ่ายเทสะดวก"},
				{PartNumber: "BA2616", PartName: "ใบปัดน้ำฝนไร้โครง Bosch Clear Advantage 26+16\"", Brand: "BOSCH", CompatibleCars: "Honda City / Jazz / Civic / HR-V", StandardPrice: 550, Unit: "คู่", Remark: "รีดน้ำเกลี้ยง ทนแดดเมืองไทย"},
				{PartNumber: "0580453443", PartName: "ปั๊มติ๊กในถัง (Fuel Pump 3.5 Bar)", Brand: "BOSCH", CompatibleCars: "Toyota, Honda, Nissan, Mitsubishi เบนซิน", StandardPrice: 1150, Unit: "ลูก", Remark: "แรงดันสม่ำเสมอ พร้อมกรองหยาบ"},
			},
		},
	}

	for _, s := range samples {
		if err := r.db.Create(&s).Error; err != nil {
			return err
		}
	}
	return nil
}
