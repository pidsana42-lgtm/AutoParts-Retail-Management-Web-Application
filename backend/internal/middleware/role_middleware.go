package middleware

import (
    "net/http"
    "github.com/gin-gonic/gin"
)

// คอยเขี่ยดูว่า Role ตรงไหม
func RequireRoles(allowedRoles ...string) gin.HandlerFunc {
    return func(c *gin.Context) {
        // 1. ดึงค่า "role" ที่ใช้ c.Set() ไว้ใน AuthMiddleware ตะกี้ขึ้นมาตรวจ
        userRole, exists := c.Get("role")
        if !exists {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
                "status":  "error",
                "message": "ไม่พบข้อมูลสิทธิ์ผู้ใช้งาน",
            })
            return
        }

        // 2. เช็กว่าสิทธิ์ที่แกะออกมา ตรงกับที่กลุ่ม Route นั้น ๆ อนุญาตไหม
        for _, role := range allowedRoles {
            if userRole == role || (userRole == "Admin" && role == "Manager") || (userRole == "Manager" && role == "Admin") {
                c.Next() // สิทธิ์ถูกต้องตรงกัน ปล่อยให้วิ่งไปทำลอจิกถัดไป
                return
            }
        }

        // 3. ถ้าไล่ดูครบแล้วไม่ตรงเลย สั่งดีดออกด้วย 403 Forbidden ห้ามเข้า!
        c.AbortWithStatusJSON(http.StatusForbidden, gin.H{
            "status":  "error",
            "message": "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้ (เฉพาะเจ้าของอู่/ร้านค้าเท่านั้น)",
        })
    }
}