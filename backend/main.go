package main

import (
	"github.com/gin-gonic/gin"
	
	"backend/config"
	//"backend/internal/middleware"
	//"backend/internal/route"
)

const PORT = "8080"

func main() {
	// ต่อ DB + migrate + seed
	config.ConnectDB()
	config.SetupDatabase()
	gin.SetMode(gin.ReleaseMode)
	// สร้าง router
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())
	//r.Use(middleware.CORSMiddleware())
	r.Static("/uploads", "./uploads")

	r.OPTIONS("/*path", func(c *gin.Context) {
	c.Status(204)
	
	})
	

	// ให้ routes จัดการ URL ทั้งหมด
	//routes.SetupRoutes(r)
	// test endpoint
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	r.Run(":" + PORT)
	
	

	
	// r.Run("localhost:" + PORT)

}