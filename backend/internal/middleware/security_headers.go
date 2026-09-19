package middleware

import "github.com/gin-gonic/gin"

// SecurityHeaders: เพิ่ม HTTP response header มาตรฐานด้านความปลอดภัยให้ทุก response ของ API
// (แก้ตามผลสแกน ZAP: X-Content-Type-Options / X-Frame-Options / Referrer-Policy ที่ขาดไป)
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("X-Content-Type-Options", "nosniff")
		c.Header("X-Frame-Options", "DENY")
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")
		c.Next()
	}
}
