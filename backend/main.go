package main

import (
	"backend/config"
	"backend/internal/app/route"
	"github.com/gin-gonic/gin"
	"os"
)

func main() {
	// 1. จัดการเรื่องฐานข้อมูลให้เรียบร้อย (ต่อ DB -> สร้างตาราง -> ยัดข้อมูล Seed)
	config.ConnectDB()
	config.SetupDatabase()

	// 2. ตั้งค่าการรัน Gin Engine
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// 3. เปิดโฟลเดอร์สำหรับฝากรูปภาพอะไหล่หรือสลิปเงิน
	r.Static("/uploads", "./uploads")

	// 4. ตั้งค่าด่าน OPTIONS สำหรับรองรับ CORS ตอนดึง API ข้ามไปหา Frontend
	r.OPTIONS("/*path", func(c *gin.Context) {
		c.Status(204)
	})

	// ไปใช้ routes.go setup function เพื่อจัดการ Route ทั้งหมด
	route.SetupAllRoutes(r, config.DB())

	// 5. Test Endpoint สำหรับเช็คสถานะเซิร์ฟเวอร์
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	// 6. ดึง Port จาก .env ถ้าไม่มีให้ใช้พอร์ต 8080 เป็นค่าเริ่มต้น
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r.Run(":" + port)
}