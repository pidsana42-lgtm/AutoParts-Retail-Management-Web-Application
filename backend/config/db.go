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
		&entity.Supplier{},
		&entity.Customer{},
		&entity.Bank{},
		&entity.Payment{},
		&entity.PaymentMethod{},
		&entity.PaymentRepayment{},
		&entity.SaleOrder{},
		&entity.SaleOrderItem{},
		&entity.StoreConfig{},

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

	// 3. สำคัญ: เปิดการตรวจสอบ Foreign Key กลับคืนสู่สถานะปกติ
	db.Exec("SET session_replication_role = 'origin';")

	// Looktao
	seed.Supplier(db)
	seed.Role(db)
	seed.CustomerType(db)
	seed.PaymentMethod(db)

	// Toto WMS
	seed.Zone(db)
	seed.Unit(db)
	seed.Category(db)
	seed.SubCategory(db)
	seed.Grade(db)
	seed.Shelf(db)
	seed.Brand(db)
	seed.Models(db)
	if err := seed.User(db); err != nil {
		log.Printf("Warning: failed to seed default user: %v", err)
	}

	seed.Customer(db)
	seed.Product(db)

	// Chompoo
	seed.PurchaseOrdersType(db)
	seed.PurchaseOrders(db)
	seed.PurchaseOrdersItems(db)

	// Siri
	seed.BillImage(db)
	seed.Bill(db)
	seed.SaleOrder(db)
	seed.SaleOrderItems(db)

	// Company Setting
	seed.CompanySetting(db)

	log.Println("Database migration complete! Server Ready.")
}
