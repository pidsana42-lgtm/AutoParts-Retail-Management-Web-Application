package config

import (
	"backend/internal/app/entity"
	"backend/seed"

	"fmt"
	"log"
	"os"
	"strings"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

func DB() *gorm.DB {
	return db
}

func ConnectDB() {
	// โหลดไฟล์ local ทีหลังเพื่อให้ตั้งค่าพอร์ตของแต่ละเครื่องได้
	// และแยกเรียกทีละไฟล์ เพราะ Overload จะหยุดทันทีเมื่อพบไฟล์ที่ไม่มีอยู่
	for _, envFile := range []string{
		".env",
		"../.env",
		"backend/.env",
		".env.local",
		"../.env.local",
		"backend/.env.local",
	} {
		if _, err := os.Stat(envFile); err != nil {
			if os.IsNotExist(err) {
				continue
			}
			log.Fatalf("failed to inspect environment file %s: %v", envFile, err)
		}

		if err := godotenv.Overload(envFile); err != nil {
			log.Fatalf("failed to load environment file %s: %v", envFile, err)
		}
	}

	requiredVariables := []string{"DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"}
	missingVariables := make([]string, 0)
	for _, variable := range requiredVariables {
		if strings.TrimSpace(os.Getenv(variable)) == "" {
			missingVariables = append(missingVariables, variable)
		}
	}
	if len(missingVariables) > 0 {
		log.Fatalf("missing required database environment variables: %s", strings.Join(missingVariables, ", "))
	}

	host := os.Getenv("DB_HOST")
	port := os.Getenv("DB_PORT")
	user := os.Getenv("DB_USER")
	password := os.Getenv("DB_PASSWORD")
	dbname := os.Getenv("DB_NAME")

	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Bangkok",
		host, user, password, dbname, port,
	)

	database, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	db = database
	log.Println("Connected to database")
}

func SetupDatabase() {
	if db == nil {
		log.Fatal("Database connection is nil. Call ConnectDB() first.")
	}

	// 1. ปิดการตรวจสอบ Foreign Key ชั่วคราว (สะดวกตอนสร้างตารางที่มีความสัมพันธ์เกี่ยวกันไปมา)
	db.Exec("SET session_replication_role = 'replica';")

	// 2. Migrate ตารางทั้งหมดในครั้งเดียว
	// เมื่อคุณมี Entity อื่นๆ ของระบบร้านอะไหล่ (เช่น AutoPart, Order, User) สามารถเอามาใส่เพิ่มตรงนี้ได้เลย
	if err := db.AutoMigrate(

		// Bill & Related Tables
		&entity.Bill{},
		&entity.BillImage{},
		&entity.BillItem{},
		&entity.BillImportJob{},
		&entity.ProductMappingCorrection{},
		&entity.PreOrder{},
		&entity.PreOrderItem{},
		&entity.Catalog{},
		&entity.CatalogItem{},
		&entity.SalesReturn{},
		&entity.SalesReturnItem{},
		&entity.CustomerClaim{},
		&entity.CustomerClaimItem{},
		&entity.SupplierClaim{},
		&entity.SupplierClaimItem{},
		&entity.ClaimStock{},

		// pos
		&entity.Role{},
		&entity.User{},
		&entity.PasswordReset{},
		&entity.Supplier{},
		&entity.Customer{},
		&entity.CustomerCreditAuditLog{},
		&entity.Bank{},
		&entity.Payment{},
		&entity.PaymentMethod{},
		&entity.PaymentRepayment{},
		&entity.SaleOrder{},
		&entity.SaleOrderItem{},
		&entity.StoreConfig{},
		&entity.StoreConfigAuditLog{},

		// โตโต้ WMS
		&entity.Category{},
		&entity.SubCategory{},
		&entity.SubSubCategory{},
		&entity.Grade{},
		&entity.Shelf{},
		&entity.ShelfLevel{},
		&entity.Zone{},
		&entity.Brand{},
		&entity.Models{},
		&entity.Unit{},
		&entity.Product{},
		&entity.ProductImage{},
		&entity.ProductImageEm{},
		&entity.Inventory{},
		&entity.StockAlert{},
		&entity.CheckStockSchedule{},
		&entity.CheckStockScheduleTarget{},
		&entity.CheckStockScheduleExcludedProduct{},
		&entity.CheckStock{},
		&entity.StockMovement{},

		// Dashboard & Purchase Orders System
		&entity.PO{},
		&entity.DailySummary{},
		&entity.POType{},
		&entity.POItems{},
		&entity.ReceiveEvidenceExcel{},

		// LINE OA system
		&entity.LineUser{},
		&entity.LineMessage{},

		// Company Setting
		&entity.CompanySetting{},

		// Notifications (กระดิ่งแจ้งเตือน)
		&entity.Notification{},
	); err != nil {
		log.Fatalf("failed to migrate schema: %v", err)
	}

	// เติมรหัสสินค้าภายในร้านให้รายการ PO เดิมหลัง AutoMigrate เพิ่มคอลัมน์ snapshot ใหม่
	// โดยเติมเฉพาะแถวที่ยังไม่มีค่า เพื่อไม่เขียนทับ snapshot ที่เคยบันทึกไว้แล้ว
	if err := db.Exec(`
		UPDATE purchase_order_items AS poi
		SET product_code_snapshot = COALESCE(products.product_code, '')
		FROM products
		WHERE products.id = poi.product_id
		  AND COALESCE(poi.product_code_snapshot, '') = ''
	`).Error; err != nil {
		log.Printf("Warning: failed to backfill PO product code snapshots: %v", err)
	}

	// 3. สำคัญ: เปิดการตรวจสอบ Foreign Key กลับคืนสู่สถานะปกติ
	db.Exec("SET session_replication_role = 'origin';")

	// ขยายขนาดคอลัมน์ id_card_number_customer เป็น varchar(255) สำหรับรองรับ AES-256 ciphertext
	_ = db.Exec("ALTER TABLE customers ALTER COLUMN id_card_number_customer TYPE varchar(255);").Error

	// เลิกใช้บาร์โค้ดกลางของสินค้าที่ตาราง products แล้ว (ย้ายไปผูกกับ Supplier แต่ละเจ้าที่ inventories แทน)
	// AutoMigrate ไม่ลบคอลัมน์ที่หายไปจาก struct ให้เอง ต้องสั่ง Drop เองแบบนี้ครั้งเดียว (เช็คก่อนกันซ้ำ)
	if db.Migrator().HasColumn(&entity.Product{}, "barcode") {
		if err := db.Migrator().DropColumn(&entity.Product{}, "barcode"); err != nil {
			log.Printf("Warning: failed to drop obsolete products.barcode column: %v", err)
		}
	}

	// System types & master config
	seed.Role(db)
	seed.CustomerType(db)
	seed.PaymentMethod(db)
	seed.PurchaseOrdersType(db)
	seed.CompanySetting(db)

	// Master lookup tables (Units, Categories, Shelves, Brands, etc.)
	seed.Supplier(db)
	seed.Zone(db)
	seed.Unit(db)
	seed.Category(db)
	seed.SubCategory(db)
	seed.Grade(db)
	seed.Shelf(db)
	seed.Brand(db)
	seed.Models(db)

	// User auth
	if err := seed.User(db); err != nil {
		log.Printf("Warning: failed to seed default user: %v", err)
	}

	// เดิม seed ใบสั่งซื้อ/สต็อกตัวอย่าง (PO-2026-0001/2/3 + สินค้า Turbocharger/Gasket/Oil ปลอม)
	// ไว้ตรงนี้เพื่อเดโม่ตอน dev แต่พอ deploy ขึ้น production จริงแล้ว มันไปติดอยู่ในหน้า PO
	// ของซัพพลายเออร์จริง (SupplierID ฮาร์ดโค้ดเป็น 1/2/3 ซึ่งบน production คือซัพพลายเออร์จริง
	// ไม่ใช่ผู้ขายปลอมที่ seed ตั้งใจไว้) ทำให้ประวัติ PO ของซัพพลายเออร์จริงมีรายการปลอมปนอยู่
	// ตัดออกแล้ว ไม่ seed ซ้ำอีก — ข้อมูลปลอมที่เคยสร้างไปแล้วบน production ถูกลบออกด้วยมือแล้ว
	// (สินค้าปลอม 3 ตัวเคยถูกขายจริงไปแล้วก่อนพบปัญหา จึงปิดใช้งาน (is_active=false) แทนการลบ
	// เพื่อไม่ให้กระทบประวัติบิลขาย/เคลมจริงที่อ้างอิงสินค้านั้นอยู่)
	// seed.PurchaseOrders(db)
	// seed.Inventory(db)
	// seed.PurchaseOrdersItems(db)

	// Siri
	// seed.BillImage(db)
	// seed.Bill(db)

	// Mock data disabled
	// seed.Customer(db)
	// seed.Product(db)

	log.Println("Database migration complete! Server Ready.")
}
