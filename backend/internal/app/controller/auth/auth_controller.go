package auth

import (
    authDTO "backend/internal/app/dto/auth"
    authSVC "backend/internal/app/service/auth"
    "net/http"
	"encoding/base64"
    "github.com/gin-gonic/gin"
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
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "รูปแบบรหัสผ่านที่ส่งมาไม่ถูกต้อง"})
		return
	}
	
	loginRequest.Password = string(decodedPassword)

	res, err := c.authService.Login(&loginRequest)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, res)
}