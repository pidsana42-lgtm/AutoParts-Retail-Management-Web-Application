package auth

import (
	authDTO "backend/internal/app/dto/auth"
	authSVC "backend/internal/app/service/auth"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

	res, err := c.authService.Login(&loginRequest)
	if err != nil {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, res)
}

func (c *AuthController) ForgotPassword(ctx *gin.Context) {
	var req authDTO.ForgotPasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกชื่อผู้ใช้งานหรืออีเมล"})
		return
	}

	if err := c.authService.ForgotPassword(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "ส่งรหัสยืนยัน (OTP) ไปยังอีเมลเรียบร้อยแล้ว"})
}

func (c *AuthController) ResetPassword(ctx *gin.Context) {
	var req authDTO.ResetPasswordRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกข้อมูลให้ครบถ้วน และรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร"})
		return
	}

	if len(req.NewPassword) < 6 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 6 ตัวอักษร"})
		return
	}

	if err := c.authService.ResetPassword(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"message": "เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบด้วยรหัสผ่านใหม่"})
}

func (ctrl *AuthController) LineCallback(c *gin.Context) {
	code := c.Query("code")
	if code == "" {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่มีรหัสยืนยันตัวตนจาก LINE"))
		return
	}

	channelID := strings.TrimSpace(os.Getenv("Channel_ID"))
	channelSecret := strings.TrimSpace(os.Getenv("Channel_secret"))

	// Construct dynamic redirect URI to match LINE login configuration automatically
	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	redirectURI := scheme + "://" + c.Request.Host + "/api/auth/line/callback"

	log.Printf("[LINE Login] Exchanging authorization code. RedirectURI: %s, ChannelID: %s\n", redirectURI, channelID)

	// Exchanging code for LINE token
	tokenURL := "https://api.line.me/oauth2/v2.1/token"
	form := url.Values{}
	form.Set("grant_type", "authorization_code")
	form.Set("code", code)
	form.Set("redirect_uri", redirectURI)
	form.Set("client_id", channelID)
	form.Set("client_secret", channelSecret)

	resp, err := http.PostForm(tokenURL, form)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ LINE ได้: "+err.Error()))
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape(fmt.Sprintf("LINE API ตอบกลับด้วยรหัส: %d", resp.StatusCode)))
		return
	}

	var tokenRes struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenRes); err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถอ่านข้อมูลโทเคนจาก LINE ได้"))
		return
	}

	// Fetch LINE Profile to get user ID
	profileURL := "https://api.line.me/v2/profile"
	req, err := http.NewRequest("GET", profileURL, nil)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถสร้างคำร้องขอโปรไฟล์ LINE ได้"))
		return
	}
	req.Header.Set("Authorization", "Bearer "+tokenRes.AccessToken)

	client := &http.Client{}
	profileResp, err := client.Do(req)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถดึงข้อมูลโปรไฟล์จาก LINE ได้: "+err.Error()))
		return
	}
	defer profileResp.Body.Close()

	if profileResp.StatusCode != http.StatusOK {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape(fmt.Sprintf("LINE Profile API ตอบกลับด้วยรหัส: %d", profileResp.StatusCode)))
		return
	}

	var profileRes struct {
		UserID string `json:"userId"`
	}
	if err := json.NewDecoder(profileResp.Body).Decode(&profileRes); err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape("ไม่สามารถอ่านข้อมูลโปรไฟล์จาก LINE ได้"))
		return
	}

	// Exchange LINE UserID for internal signed JWT
	res, err := ctrl.authService.LoginWithLine(profileRes.UserID)
	if err != nil {
		c.Redirect(http.StatusFound, "http://localhost:5173/login?error="+url.QueryEscape(err.Error()))
		return
	}

	// Success! Redirect to frontend login callback parser
	c.Redirect(http.StatusFound, fmt.Sprintf("http://localhost:5173/login?token=%s&role=%s&username=%s&first_name=%s&id=%d",
		res.Token, res.Role, res.Username, res.FirstName, res.ID))
}

func authenticatedUserID(ctx *gin.Context) (uint, bool) {
	rawUserID, exists := ctx.Get("user_id")
	if !exists {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "ไม่พบข้อมูลผู้ใช้จากโทเคน"})
		return 0, false
	}

	parsedUserID, err := strconv.ParseUint(fmt.Sprint(rawUserID), 10, 64)
	if err != nil || parsedUserID == 0 {
		ctx.JSON(http.StatusUnauthorized, gin.H{"error": "ข้อมูลผู้ใช้ในโทเคนไม่ถูกต้อง"})
		return 0, false
	}
	return uint(parsedUserID), true
}

func (c *AuthController) GetProfile(ctx *gin.Context) {
	userID, ok := authenticatedUserID(ctx)
	if !ok {
		return
	}

	profile, err := c.authService.GetProfile(userID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "ไม่พบข้อมูลโปรไฟล์"})
		return
	}
	ctx.JSON(http.StatusOK, profile)
}

func (c *AuthController) UpdateProfile(ctx *gin.Context) {
	userID, ok := authenticatedUserID(ctx)
	if !ok {
		return
	}

	var request authDTO.UpdateProfileRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกข้อมูลโปรไฟล์ให้ครบ"})
		return
	}

	profile, err := c.authService.UpdateProfile(userID, &request)
	if err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, profile)
}

func (c *AuthController) ChangePassword(ctx *gin.Context) {
	userID, ok := authenticatedUserID(ctx)
	if !ok {
		return
	}

	var request authDTO.ChangePasswordRequest
	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณากรอกรหัสผ่านให้ครบ"})
		return
	}
	if err := c.authService.ChangePassword(userID, &request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"message": "เปลี่ยนรหัสผ่านเรียบร้อยแล้ว"})
}

func (c *AuthController) UploadProfileImage(ctx *gin.Context) {
	userID, ok := authenticatedUserID(ctx)
	if !ok {
		return
	}
	file, err := ctx.FormFile("avatar")
	if err != nil || file.Size > 5*1024*1024 {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "กรุณาเลือกไฟล์รูปภาพไม่เกิน 5MB"})
		return
	}
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".jpg" && ext != ".jpeg" && ext != ".png" && ext != ".webp" && ext != ".gif" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ GIF"})
		return
	}
	dir := filepath.Join("uploads", "employees")
	if err := os.MkdirAll(dir, 0755); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถเตรียมพื้นที่เก็บรูปภาพได้"})
		return
	}
	filename := uuid.NewString() + ext
	if err := ctx.SaveUploadedFile(file, filepath.Join(dir, filename)); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกรูปภาพได้"})
		return
	}
	path := "/uploads/employees/" + filename
	if err := c.authService.SaveProfileImage(userID, path); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถบันทึกรูปโปรไฟล์ได้"})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"profile_image_path": path})
}

func (c *AuthController) DeleteProfileImage(ctx *gin.Context) {
	userID, ok := authenticatedUserID(ctx)
	if !ok {
		return
	}
	if err := c.authService.SaveProfileImage(userID, ""); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "ไม่สามารถลบรูปโปรไฟล์ได้"})
		return
	}
	ctx.Status(http.StatusNoContent)
}
