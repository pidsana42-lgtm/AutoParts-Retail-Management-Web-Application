package config

import (
	"backend/seed"
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

		// Bill & Related Tables
		&entity.Bill{},
		&entity.BillImage{},
		&entity.BillItem{},
		&entity.BillImportJob{},
		&entity.PreOrder{},
		&entity.PreOrderItem{},
		&entity.SalesReturn{},
		&entity.SalesReturnItem{},
		&entity.CustomerClaim{},
		&entity.CustomerClaimItem{},
		&entity.SupplierClaim{},
		&entity.SupplierClaimItem{},

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
		&entity.Grade{},
		&entity.Shelf{},
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
  seed.StoreConfig(db)
    
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
	
	seed.PurchaseOrdersType(db)
	seed.PurchaseOrders(db)
	seed.BillImage(db)
	seed.Bill(db)
	seed.SaleOrder(db)

    log.Println("Database migration complete! Server Ready.")
}
