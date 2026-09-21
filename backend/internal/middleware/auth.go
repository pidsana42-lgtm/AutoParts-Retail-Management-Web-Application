package middleware

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// jwtSecret: main.go เช็คตั้งแต่ตอนสตาร์ทแล้วว่า JWT_SECRET ต้องถูกตั้งค่าไว้ (ไม่งั้นโปรแกรมจะไม่ขึ้นเลย)
// ที่นี่แค่อ่านค่ามาใช้เฉยๆ ไม่มี fallback เป็นค่า default ที่ฝังในซอร์สโค้ดอีกต่อไป (ของเดิมเงียบๆ ใช้ค่า
// default ถ้าไม่ได้ตั้งค่า ทำให้ใครก็ปลอม JWT ได้ถ้ารู้ค่านั้นจาก GitHub)
func jwtSecret() []byte {
	return []byte(os.Getenv("JWT_SECRET"))
}

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		var tokenString string
		auth := c.GetHeader("Authorization")
		if auth != "" {
			// รูปแบบต้องเป็น "Bearer <token>"
			parts := strings.SplitN(auth, " ", 2)
			if len(parts) == 2 && strings.ToLower(parts[0]) == "bearer" {
				tokenString = parts[1]
			}
		}

		// ถ้าไม่มีใน Header ลองอ่านจาก query parameter ?token= (สำหรับ <img> tag หรือเปิดดูใน tab ใหม่)
		if tokenString == "" {
			tokenString = c.Query("token")
		}

		if tokenString == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing authorization header or token"})
			return
		}

		claims := jwt.MapClaims{}
		token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
			if t.Method != jwt.SigningMethodHS256 {
				return nil, fmt.Errorf("unexpected signing method")
			}
			return jwtSecret(), nil
		})

		if err != nil || !token.Valid {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			return
		}

		// ดึงค่าข้อมูลจาก Token และเซ็ตลง Context เพื่อให้ Controller ดึงไปใช้ต่อได้ง่ายๆ
		if uid, ok := claims["user_id"]; ok {
			c.Set("user_id", uid)
		}
		if role, ok := claims["role"]; ok {
			c.Set("role", role)
		}

		c.Set("claims", claims)
		c.Next()
	}
}