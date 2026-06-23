package config

import (
	"backend/config/seed"
	"backend/internal/app/entity"

	"fmt"
	"log"
	"os"

	"github.com/joho/godotenv"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var db *gorm.DB

func DB() *gorm.DB {
	return db
}

func ConnectDB() {
	// ค้นหาไฟล์ .env จากโฟลเดอร์หลักของ backend
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using environment variables only")
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
		//ลูกเต๋า
		&entity.Role{},
		&entity.Category{},
		&entity.SubCategory{},
		&entity.Grade{},
		&entity.Shelf{},
		&entity.Zone{},
		&entity.Brand{},
		&entity.Models{},
		&entity.Unit{},
		&entity.Product{},
		&entity.Inventory{},	
		&entity.StockAlert{},
		&entity.CheckStock{},
		// &entity.User{},       // ปลดคอมเมนต์เมื่อสร้าง Entity เหล่านี้เสร็จ
		// &entity.AutoPart{},
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
		// Dashboard & Purchase Orders System
		&entity.DailySummary{},
		&entity.PO_Type{},
		&entity.PO{},
		&entity.PO_items{},
		&entity.ReceiveEvidenceExcel{},
	); err != nil {
		log.Fatalf("failed to migrate schema: %v", err)
	}

	// 3. สำคัญ: เปิดการตรวจสอบ Foreign Key กลับคืนสู่สถานะปกติ
	db.Exec("SET session_replication_role = 'origin';")

	seed.Role(db)

	log.Println("Database migration complete! Server Ready.")
}
