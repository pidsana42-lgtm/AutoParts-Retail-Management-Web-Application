package auth

import (
	authDTO "backend/internal/app/dto/auth"
	authSVC "backend/internal/app/service/auth"
	"encoding/base64"
	"github.com/gin-gonic/gin"
	"net/http"
)

type AuthController struct {
	authService authSVC.AuthService
}

func NewAuthController(authService authSVC.AuthService) *AuthController {
	return &AuthController{authService: authService}
}

func (c *AuthController) Login(ctx *gin.Context) {
	var loginRequest authDTO.LoginRequest
	if err := ctx.ShouldBindJSON(&loginRequest); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกชื่อผู้ใช้งานและรหัสผ่าน"})
		return
	}

	decodedPassword, err := base64.StdEncoding.DecodeString(loginRequest.Password)
    if err == nil {
        // ✅ ถ้า Decode สำเร็จ (มาจาก Frontend) ค่อยสลับเอาตัวถอดรหัสมาใช้
        loginRequest.Password = string(decodedPassword)
    }
    // 🎯 ลบบรรทัด loginRequest.Password = string(decodedPassword) ที่เคยอยู่ตรงนี้ทิ้งไปเลย!

    res, err := c.authService.Login(&loginRequest)

	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, res)
}