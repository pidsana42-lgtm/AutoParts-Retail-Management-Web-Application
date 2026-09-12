package main

import (
	"log"
	"os"

	"backend/config"
	"backend/internal/app/route"
	"backend/internal/middleware"
	"backend/internal/pkg/monitoring"
	"backend/internal/pkg/websocket"

	"github.com/gin-gonic/gin"
)

func main() {
	// 1. จัดการเรื่องฐานข้อมูลให้เรียบร้อย (ต่อ DB -> สร้างตาราง -> ยัดข้อมูล Seed)
	config.ConnectDB()
	config.SetupDatabase()

	// Initialize WebSocket Hub
	websocket.InitHub()

	// 2. ตั้งค่าการรัน Gin Engine
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	sqlDB, err := config.DB().DB()
	if err != nil {
		log.Fatalf("failed to access database connection for monitoring: %v", err)
	}
	metricsRegistry, httpMetrics := monitoring.NewRegistry(sqlDB)

	// Prometheus middleware wraps Recovery so panic responses are recorded as 500.
	r.Use(gin.Logger(), middleware.PrometheusMetrics(httpMetrics), gin.Recovery())
	r.Use(middleware.CORSMiddleware())

	// 3. เปิดโฟลเดอร์สำหรับฝากรูปภาพอะไหล่หรือสลิปเงิน
	r.Static("/uploads", "./uploads")
	r.Static("/barcode", "./barcode")
	r.Static("/qrcode", "./QRCode")

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
	r.GET("/metrics", gin.WrapH(monitoring.Handler(metricsRegistry)))

	// WebSocket Route
	r.GET("/ws", websocket.ServeWS)

	// 6. ดึง Port จาก .env ถ้าไม่มีให้ใช้พอร์ต 8080 เป็นค่าเริ่มต้น
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
